import type { Document } from "mongodb";
import { getDb, nextSequence } from "../../db.ts";
import { serviceContext, type RequestContext } from "../../policies.ts";
import { runSelect, runUpdate } from "../../postgrest/engine.ts";
import { parseQuery } from "../../postgrest/parse.ts";
import type { TableDef } from "../../schema.ts";
import type { RpcHandler } from "../context.ts";
import { isManagerRole, isSuperAdmin } from "./policies.ts";

/** Ports of the original database trigger functions, views and RPC functions */

const pad5 = (n: number) => String(n).padStart(5, "0");
const year = () => String(new Date().getFullYear());
const today = () => new Date().toISOString().slice(0, 10);

/** Postgres date + interval 'n months' (clamps to the last day of the month) */
function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function subtractInterval(date: string, amount: number, unit: "months" | "days"): string {
  if (unit === "months") return addMonths(date, -amount);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - amount);
  return d.toISOString().slice(0, 10);
}

/** public.fleet_driver_at_date(_vehicle_id, _date) */
async function fleetDriverAtDate(vehicleId: string, date: string): Promise<string | null> {
  const rows = await getDb()
    .collection("fleet_driver_assignments")
    .find({ vehicle_id: vehicleId, start_date: { $lte: date }, $or: [{ end_date: null }, { end_date: { $gte: date } }] })
    .sort({ start_date: -1 })
    .limit(1)
    .toArray();
  return (rows[0]?.driver_id as string | undefined) ?? null;
}

/** public.generate_equipment_order_number(): EQ- + (max numeric suffix + 1) */
async function generateEquipmentOrderNumber(): Promise<string> {
  const rows = await getDb()
    .collection("equipment_orders")
    .find({ order_number: { $regex: /^EQ-/ } })
    .project({ order_number: 1 })
    .toArray();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.order_number).slice(3), 10) || 0), 0);
  return `EQ-${pad5(max + 1)}`;
}

const blank = (v: unknown) => v === null || v === undefined || v === "";

/** machines_notify_n8n(): POSTs machine additions / status changes to the configured n8n webhook */
async function notifyMachinesWebhook(op: "INSERT" | "UPDATE", row: Document, old: Document | null) {
  try {
    if (op === "UPDATE" && row.current_status === old?.current_status) return;
    const setting = await getDb().collection("system_settings").findOne({ setting_key: "n8n_machines_webhook_url" });
    const url = setting?.setting_value;
    if (typeof url !== "string" || url === "" || url === "null") return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: op === "INSERT" ? "machine_added" : "status_changed",
        machine_id: row._id,
        machine_name: row.machine_name,
        current_location: row.current_location,
        supplier_name: row.supplier_name,
        current_status: row.current_status,
        previous_status: op === "UPDATE" ? (old?.current_status ?? null) : null,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // never fail the write due to webhook error
  }
}

/** Adds BEFORE/AFTER triggers to the generated table definitions */
export function applyTriggers(tables: Record<string, TableDef>) {
  tables.proposals.beforeInsert = async (row) => {
    if (blank(row.proposal_number)) row.proposal_number = `YRK-${pad5(await nextSequence("proposal_number_seq", 1000))}`;
  };
  tables.purchase_orders.beforeInsert = async (row) => {
    if (blank(row.order_number)) {
      row.order_number = `PO-${year()}-${pad5(await nextSequence("purchase_order_number_seq", 1))}`;
    }
  };
  tables.procurement_orders.beforeInsert = async (row) => {
    if (blank(row.order_number)) {
      row.order_number = `ORD-${year()}-${pad5(await nextSequence("procurement_order_seq", 1))}`;
    }
  };

  // fleet_calc_leasing_end: BEFORE INSERT OR UPDATE OF leasing_start_date, leasing_months
  const leasingEnd = (row: Record<string, any>) => {
    row.leasing_end_date =
      row.leasing_start_date && row.leasing_months !== null && row.leasing_months !== undefined
        ? addMonths(row.leasing_start_date, Number(row.leasing_months))
        : null;
  };
  tables.fleet_vehicles.beforeInsert = (row) => leasingEnd(row);
  tables.fleet_vehicles.beforeUpdate = (row, _ctx, old) => {
    if (row.leasing_start_date !== old?.leasing_start_date || row.leasing_months !== old?.leasing_months) leasingEnd(row);
  };

  // fleet_update_current_km: AFTER INSERT ON fleet_km_readings
  tables.fleet_km_readings.afterWrite = async (op, row) => {
    if (op !== "INSERT" || !row?.vehicle_id) return;
    const vehicle = await getDb().collection("fleet_vehicles").findOne({ _id: row.vehicle_id });
    if (!vehicle) return;
    const km = Math.max(Number(vehicle.current_km ?? 0), Number(row.reading_km ?? 0));
    await runUpdate(
      "fleet_vehicles",
      { current_km: km },
      parseQuery(new URLSearchParams({ id: `eq.${row.vehicle_id}` })),
      serviceContext(),
      { returning: false },
    );
  };

  // fleet_fines_auto_attribute: BEFORE INSERT OR UPDATE OF vehicle_id, fine_date
  const attributeFine = async (row: Record<string, any>) => {
    if (blank(row.driver_id) && row.vehicle_id && row.fine_date) {
      row.driver_id = await fleetDriverAtDate(row.vehicle_id, row.fine_date);
    }
  };
  tables.fleet_fines.beforeInsert = attributeFine;
  tables.fleet_fines.beforeUpdate = async (row, _ctx, old) => {
    if (row.vehicle_id !== old?.vehicle_id || row.fine_date !== old?.fine_date) await attributeFine(row);
  };

  // machines_notify_n8n: AFTER INSERT, AFTER UPDATE OF current_status
  tables.machines.afterWrite = async (op, row, old) => {
    if (op === "DELETE" || !row) return;
    void notifyMachinesWebhook(op, row, old);
  };

  // set_survey_assigned_manager: BEFORE INSERT ON customer_surveys
  tables.customer_surveys.beforeInsert = async (row) => {
    if (row.template_id && blank(row.assigned_manager_id)) {
      const tpl = await getDb().collection("survey_templates").findOne({ _id: row.template_id });
      row.assigned_manager_id = tpl?.assigned_manager_id ?? null;
    }
  };

  // one active assignment per vehicle (CREATE UNIQUE INDEX ... WHERE end_date IS NULL)
  tables.fleet_driver_assignments.partialUnique = [
    { name: "idx_fleet_assign_one_active", cols: ["vehicle_id"], where: { end_date: null } },
  ];
  tables.employee_form_submissions.partialUnique = [
    { name: "ux_efs_fillout_submission_id", cols: ["fillout_submission_id"], where: { fillout_submission_id: { $ne: null } } },
  ];
}

/** CREATE VIEW definitions (computed in memory) */
export function addViews(tables: Record<string, TableDef>) {
  const pick = (table: string, cols: string[]) =>
    Object.fromEntries(cols.map((c) => [c, { ...tables[table].columns[c], required: false, default: undefined }]));

  const surveyCols = [
    "id",
    "name",
    "description",
    "question_1",
    "question_2",
    "question_3",
    "question_4",
    "question_5",
    "show_manager_field",
    "show_branch_field",
    "show_role_field",
    "extra_questions",
    "is_active",
  ];
  tables.public_survey_templates = {
    pk: "id",
    columns: pick("survey_templates", surveyCols),
    view: async () =>
      (await getDb().collection("survey_templates").find({ is_active: true }).toArray()).map((d) =>
        Object.fromEntries(Object.entries(d).filter(([k]) => k === "_id" || surveyCols.includes(k))),
      ),
  };

  const itemCols = ["id", "supplier_id", "supplier_sku", "supplier_product_name", "purchase_unit", "pack_size", "unit_price", "notes"];
  tables.public_price_list = {
    pk: "id",
    columns: { ...pick("supplier_catalog_items", itemCols), supplier_name: { type: "text" } },
    view: async () => {
      const suppliers = await getDb().collection("suppliers").find({ active: true }).toArray();
      const names = new Map(suppliers.map((s) => [s._id, s.name]));
      const items = await getDb()
        .collection("supplier_catalog_items")
        .find({ active: true, supplier_id: { $in: [...names.keys()] } })
        .toArray();
      return items.map((i) => ({
        ...Object.fromEntries(Object.entries(i).filter(([k]) => k === "_id" || itemCols.includes(k))),
        supplier_name: names.get(i.supplier_id) ?? null,
      }));
    },
  };

  const requestCols = [
    "id",
    "user_id",
    "item_name",
    "description",
    "quantity",
    "justification",
    "needed_by_date",
    "status",
    "rejection_reason",
    "created_at",
    "updated_at",
  ];
  tables.purchase_requests_employee = {
    pk: "id",
    columns: pick("purchase_requests", requestCols),
    view: async () =>
      (await getDb().collection("purchase_requests").find().toArray()).map((d) =>
        Object.fromEntries(Object.entries(d).filter(([k]) => k === "_id" || requestCols.includes(k))),
      ),
  };
}

async function countVisible(table: string, params: Record<string, string>, ctx: RequestContext) {
  const { total } = await runSelect(table, parseQuery(new URLSearchParams(params)), ctx, { headOnly: true });
  return total;
}

async function hasRoleFor(userId: string, role: string) {
  return !!(await getDb().collection("user_roles").findOne({ user_id: userId, role }));
}

async function modulePermission(userId: string, moduleName: string) {
  const mod = await getDb().collection("modules").findOne({ name: moduleName });
  if (!mod) return null;
  return getDb().collection("user_module_permissions").findOne({ user_id: userId, module_id: mod._id });
}

/** Functions callable through supabase.rpc() */
export const rpc: Record<string, RpcHandler> = {
  // Not SECURITY DEFINER: counts only complaints visible to the caller
  get_customer_complaint_count: async ({ phone, months_back = 6 }, ctx) =>
    countVisible(
      "complaints",
      { customer_phone: `eq.${phone}`, incident_date: `gte.${subtractInterval(today(), Number(months_back), "months")}` },
      ctx,
    ),
  get_manager_complaint_count: async ({ mgr_id, days_back = 14 }, ctx) =>
    countVisible(
      "complaints",
      { manager_id: `eq.${mgr_id}`, incident_date: `gte.${subtractInterval(today(), Number(days_back), "days")}` },
      ctx,
    ),
  generate_equipment_order_number: async () => generateEquipmentOrderNumber(),
  generate_proposal_number: async () => `YRK-${pad5(await nextSequence("proposal_number_seq", 1000))}`,
  generate_po_number: async () => `PO-${year()}-${pad5(await nextSequence("purchase_order_number_seq", 1))}`,
  has_role: async ({ _user_id, _role }) => hasRoleFor(_user_id, _role),
  is_super_admin: async ({ _user_id }) => hasRoleFor(_user_id, "super_admin"),
  is_manager: async ({ _user_id }) => (await hasRoleFor(_user_id, "manager")) || hasRoleFor(_user_id, "super_admin"),
  is_client: async ({ _user_id }) => hasRoleFor(_user_id, "client"),
  has_module_access: async ({ _user_id, _module_name }) => {
    const perm = await modulePermission(_user_id, _module_name);
    return perm ? !!perm.has_access : hasRoleFor(_user_id, "super_admin");
  },
  get_user_data_scope: async ({ _user_id, _module_name }) =>
    (await modulePermission(_user_id, _module_name))?.data_scope ?? "personal",
  get_team_member_ids: async ({ _user_id }) => {
    const teams = await getDb().collection("teams").distinct("_id", { manager_id: _user_id });
    const ids = await getDb().collection("team_members").distinct("user_id", { team_id: { $in: teams } });
    return ids.length ? ids : null;
  },
  can_access_proposal: async ({ _proposal_id }, ctx) => {
    const proposal = await getDb().collection("proposals").findOne({ _id: _proposal_id });
    return !!proposal && (isManagerRole(ctx) || (!!ctx.uid && proposal.client_user_id === ctx.uid));
  },
  fleet_driver_at_date: async ({ _vehicle_id, _date }) => fleetDriverAtDate(_vehicle_id, _date),
  // pg_cron helpers called by update-cron-settings; schedules are managed by the server's cron instead
  cron_schedule: async (args) => {
    await getDb()
      .collection("_cron_jobs")
      .updateOne({ _id: args.job_name }, { $set: { ...args, updated_at: new Date() } }, { upsert: true });
    return null;
  },
  cron_unschedule: async ({ job_name }) => {
    await getDb().collection("_cron_jobs").deleteOne({ _id: job_name });
    return null;
  },
};

export { isSuperAdmin };
