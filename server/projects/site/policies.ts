import type { Document, Filter } from "mongodb";
import { getDb } from "../../db.ts";
import { ALL, anyOf, distinct, hasRole, memo, type RequestContext, type TablePolicies } from "../../policies.ts";

/**
 * Row level security of the website's internal system, ported from the final set of
 * row-level security policies of the original site database. Each `p(...)` mirrors one policy.
 */

type Expr = (ctx: RequestContext) => Filter<Document> | null | false | Promise<Filter<Document> | null | false>;
type Cmd = "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
type To = "public" | "authenticated" | "anon";

interface Policy {
  cmd: Cmd;
  to: To[];
  using?: Expr;
  check?: Expr;
}

const p = (cmd: Cmd, to: To | To[], using?: Expr, check?: Expr): Policy => ({
  cmd,
  to: Array.isArray(to) ? to : [to],
  using,
  check,
});

const appliesTo = (policy: Policy, ctx: RequestContext) =>
  policy.to.includes("public") ||
  (ctx.role === "authenticated" && policy.to.includes("authenticated")) ||
  (ctx.role === "anon" && policy.to.includes("anon"));

/** Combines policies the way Postgres does: permissive policies for a command are OR'ed */
function table(...list: Policy[]): TablePolicies {
  const combine = (cmds: Cmd[], pick: (pol: Policy) => Expr | undefined) => async (ctx: RequestContext) => {
    const parts: (Filter<Document> | null | false)[] = [];
    for (const pol of list) {
      if (!cmds.includes(pol.cmd) || !appliesTo(pol, ctx)) continue;
      const expr = pick(pol);
      if (expr) parts.push(await expr(ctx));
    }
    return anyOf(...parts);
  };
  return {
    select: combine(["SELECT", "ALL"], (pol) => pol.using),
    insert: combine(["INSERT", "ALL"], (pol) => pol.check ?? pol.using),
    update: combine(["UPDATE", "ALL"], (pol) => pol.using),
    updateCheck: combine(["UPDATE", "ALL"], (pol) => pol.check ?? pol.using),
    delete: combine(["DELETE", "ALL"], (pol) => pol.using),
  };
}

// ---------------------------------------------------------------- expression helpers

const isSuperAdmin = (ctx: RequestContext) => hasRole(ctx, "super_admin");
/** public.is_manager(): manager or super_admin */
const isManagerRole = (ctx: RequestContext) => hasRole(ctx, "manager") || isSuperAdmin(ctx);

const T: Expr = () => ALL;
const F: Expr = () => null;
const sup: Expr = (ctx) => (isSuperAdmin(ctx) ? ALL : null);
const mgr: Expr = (ctx) => (isManagerRole(ctx) ? ALL : null);
const hasAnyRole =
  (...roles: string[]): Expr =>
  (ctx) =>
    roles.some((r) => hasRole(ctx, r)) ? ALL : null;
/** column = auth.uid() */
const own =
  (column: string): Expr =>
  (ctx) =>
    ctx.uid ? { [column]: ctx.uid } : null;
const or =
  (...exprs: Expr[]): Expr =>
  async (ctx) =>
    anyOf(...(await Promise.all(exprs.map((e) => e(ctx)))));
/** Role condition AND row condition */
const when =
  (cond: Expr, expr: Expr): Expr =>
  async (ctx) =>
    (await cond(ctx)) ? expr(ctx) : null;
const eq =
  (column: string, value: unknown): Expr =>
  () => ({ [column]: value });
const inIds =
  (column: string, ids: (ctx: RequestContext) => Promise<unknown[]>): Expr =>
  async (ctx) =>
    ctx.uid ? { [column]: { $in: await ids(ctx) } } : null;

const idsWhere = (ctx: RequestContext, key: string, collection: string, field: string, filter: Filter<Document>) =>
  memo(ctx, key, () => distinct(collection, field, filter));

// ---------------------------------------------------------------- subquery sets

const complaintsManagedBy = (ctx: RequestContext) =>
  idsWhere(ctx, "complaintsManagedBy", "complaints", "_id", { manager_id: ctx.uid });
const ownEquipmentOrders = (ctx: RequestContext) =>
  idsWhere(ctx, "ownEquipmentOrders", "equipment_orders", "_id", { user_id: ctx.uid });
const ownFleetDriverIds = (ctx: RequestContext) =>
  idsWhere(ctx, "ownFleetDriverIds", "fleet_drivers", "_id", { user_id: ctx.uid });
const ownProcurementOrders = (ctx: RequestContext) =>
  idsWhere(ctx, "ownProcurementOrders", "procurement_orders", "_id", { created_by: ctx.uid });
const ownEditableProcurementOrders = (ctx: RequestContext) =>
  idsWhere(ctx, "ownEditableProcurementOrders", "procurement_orders", "_id", {
    created_by: ctx.uid,
    status: { $in: ["draft", "returned_for_fix"] },
  });
const clientProposals = (ctx: RequestContext) =>
  idsWhere(ctx, "clientProposals", "proposals", "_id", { client_user_id: ctx.uid });
const createdProposals = (ctx: RequestContext) =>
  idsWhere(ctx, "createdProposals", "proposals", "_id", { created_by: ctx.uid });
const assignedRequests = (ctx: RequestContext) =>
  idsWhere(ctx, "assignedRequests", "requests", "_id", { assigned_to: ctx.uid });
const memberTeams = (ctx: RequestContext) =>
  idsWhere(ctx, "memberTeams", "team_members", "team_id", { user_id: ctx.uid });

/** Anyone-can-submit survey validation (customer_surveys INSERT policy) */
const validSurvey: Expr = () => ({
  $where: function (this: Record<string, any>) {
    const len = (v: unknown) => String(v ?? "").length;
    const rating = (v: unknown) => typeof v === "number" && v >= 1 && v <= 5;
    const phone = String(this.customer_phone ?? "");
    return (
      len(phone) >= 7 &&
      len(phone) <= 20 &&
      /^[0-9+\-\s()]+$/.test(phone) &&
      len(this.chain_name) >= 1 &&
      len(this.chain_name) <= 120 &&
      len(this.branch_name) >= 1 &&
      len(this.branch_name) <= 120 &&
      len(this.manager_name) >= 1 &&
      len(this.manager_name) <= 120 &&
      rating(this.rating_cleanliness) &&
      rating(this.rating_punctuality) &&
      rating(this.rating_manager_service) &&
      rating(this.rating_issue_handling) &&
      rating(this.rating_overall) &&
      len(this.free_text) <= 2000 &&
      len(this.respondent_name) <= 120
    );
  },
});

const managerOrSuper = or(sup, mgr);

// ---------------------------------------------------------------- policies per table

export const policies: Record<string, TablePolicies> = {
  area_manager_audits: table(
    p("INSERT", "authenticated", undefined, or(eq("submitted_by", null), own("submitted_by"))),
    p("SELECT", "authenticated", mgr),
    p("UPDATE", "authenticated", mgr, mgr),
    p("DELETE", "authenticated", sup),
    p("SELECT", "anon", F),
    p("INSERT", "anon", undefined, eq("submitted_by", null)),
  ),
  audit_log: table(
    p("SELECT", "public", sup),
    p("INSERT", "public", undefined, own("user_id")),
  ),
  branches: table(p("ALL", "authenticated", mgr), p("SELECT", "authenticated", mgr)),
  client_invoices: table(
    p("SELECT", "authenticated", or(own("client_user_id"), sup, mgr)),
    p("INSERT", "authenticated", undefined, or(sup, mgr)),
    p("UPDATE", "authenticated", or(sup, mgr)),
    p("DELETE", "authenticated", sup),
  ),
  client_item_mappings: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  client_logos: table(
    p("SELECT", "public", T),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  clients: table(
    p("ALL", "authenticated", mgr),
    p("SELECT", "public", mgr),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  complaint_attachments: table(
    p("ALL", "public", sup),
    p("SELECT", "public", mgr),
    p("INSERT", "public", undefined, mgr),
    p("SELECT", "public", inIds("complaint_id", complaintsManagedBy)),
  ),
  complaints: table(
    p("ALL", "public", sup),
    p("SELECT", "public", mgr),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("SELECT", "public", own("manager_id")),
  ),
  contact_inquiries: table(
    p("ALL", "public", sup),
    p("SELECT", "public", hasAnyRole("manager")),
    p("UPDATE", "public", hasAnyRole("manager")),
    p("INSERT", "public", undefined, T),
  ),
  customer_surveys: table(
    p("SELECT", "public", mgr),
    p("DELETE", "public", mgr),
    p("UPDATE", "public", mgr),
    p("INSERT", ["anon", "authenticated"], undefined, validSurvey),
  ),
  documents: table(
    p("ALL", "public", sup),
    p("SELECT", "public", mgr),
    p("SELECT", "public", own("driver_id")),
    p("INSERT", "public", undefined, or(own("driver_id"), own("uploaded_by"))),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  employee_form_submissions: table(
    p("SELECT", "authenticated", mgr),
    p("UPDATE", "authenticated", mgr, mgr),
    p("DELETE", "authenticated", when(sup, () => ({ status: { $nin: ["completed", null] } }))),
    p("INSERT", "authenticated", undefined, mgr),
  ),
  equipment_items: table(p("ALL", "public", managerOrSuper), p("SELECT", "authenticated", managerOrSuper)),
  equipment_order_items: table(
    p(
      "SELECT",
      "public",
      or(mgr, sup, inIds("order_id", ownEquipmentOrders)),
    ),
    p("INSERT", "public", undefined, inIds("order_id", ownEquipmentOrders)),
  ),
  equipment_orders: table(
    p("SELECT", "public", or(own("user_id"), mgr, sup)),
    p("INSERT", "public", undefined, own("user_id")),
    p("UPDATE", "public", managerOrSuper),
  ),
  external_sync_log: table(p("SELECT", "public", sup)),
  external_sync_state: table(p("SELECT", "public", sup)),
  field_tasks: table(
    p("SELECT", "authenticated", or(own("assigned_to"), own("assigned_by"), mgr)),
    p("INSERT", "authenticated", undefined, mgr),
    p("UPDATE", "authenticated", or(own("assigned_to"), own("assigned_by"), mgr)),
    p("DELETE", "authenticated", mgr),
  ),
  fleet_alerts: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_documents: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_driver_assignments: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  fleet_drivers: table(
    p("ALL", "authenticated", managerOrSuper, managerOrSuper),
    p("SELECT", "authenticated", own("user_id")),
  ),
  fleet_fines: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_incidents: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_km_monthly: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  fleet_km_readings: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_maintenance: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_monthly_km_reports: table(p("ALL", "authenticated", managerOrSuper, managerOrSuper)),
  fleet_n8n_events: table(p("SELECT", "authenticated", sup)),
  fleet_vehicles: table(
    p("ALL", "authenticated", sup, sup),
    p("SELECT", "authenticated", when(mgr, own("manager_id"))),
    p("UPDATE", "authenticated", when(mgr, own("manager_id")), when(mgr, own("manager_id"))),
    p("SELECT", "authenticated", inIds("driver_id", ownFleetDriverIds)),
  ),
  internal_catalog_items: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  logistics_equipment: table(p("ALL", "public", managerOrSuper)),
  machine_history: table(p("ALL", "authenticated", mgr, mgr)),
  machine_repairs: table(p("ALL", "authenticated", mgr, mgr)),
  machine_service_requests: table(p("ALL", "authenticated", mgr, mgr)),
  machines: table(p("ALL", "authenticated", mgr, mgr)),
  management_hours: table(p("ALL", "authenticated", mgr, mgr)),
  manager_tasks: table(
    p("INSERT", "public", undefined, mgr),
    p("SELECT", "public", mgr),
    p("SELECT", "public", own("assigned_to")),
    p("UPDATE", "public", own("assigned_to")),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  modules: table(
    p("SELECT", "public", (ctx) => (ctx.uid ? { is_active: true } : null)),
    p("ALL", "public", sup),
  ),
  notification_reads: table(
    p("INSERT", "public", undefined, own("user_id")),
    p("SELECT", "public", own("user_id")),
    p("SELECT", "public", mgr),
    p("UPDATE", "public", own("user_id")),
  ),
  notifications: table(
    p("INSERT", "public", undefined, mgr),
    p("SELECT", "public", mgr),
    p("SELECT", "public", (ctx) =>
      anyOf(
        { target_type: "all" },
        ctx.uid ? { target_user_id: ctx.uid } : null,
        ctx.uid ? { target_type: "role", target_role: { $in: [...ctx.roles] } } : null,
      ),
    ),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  procurement_n8n_logs: table(p("SELECT", "authenticated", sup)),
  procurement_order_activity: table(
    p("SELECT", "authenticated", or(mgr, inIds("order_id", ownProcurementOrders))),
    p("INSERT", "authenticated", undefined, or(mgr, inIds("order_id", ownProcurementOrders))),
  ),
  procurement_order_lines: table(
    p("SELECT", "authenticated", or(mgr, inIds("order_id", ownProcurementOrders))),
    p("INSERT", "authenticated", undefined, or(mgr, inIds("order_id", ownEditableProcurementOrders))),
    p("DELETE", "authenticated", or(mgr, inIds("order_id", ownEditableProcurementOrders))),
    p(
      "UPDATE",
      "authenticated",
      or(mgr, inIds("order_id", ownEditableProcurementOrders)),
      or(mgr, inIds("order_id", ownEditableProcurementOrders)),
    ),
  ),
  procurement_order_versions: table(
    p("SELECT", "authenticated", or(mgr, inIds("order_id", ownProcurementOrders))),
    p("INSERT", "authenticated", undefined, mgr),
    p("UPDATE", "authenticated", mgr, mgr),
    p("SELECT", "authenticated", mgr),
    p("INSERT", "authenticated", undefined, mgr),
    p("UPDATE", "authenticated", mgr, mgr),
    p("DELETE", "authenticated", sup),
  ),
  procurement_orders: table(
    p("SELECT", "authenticated", or(own("created_by"), mgr)),
    p("INSERT", "authenticated", undefined, own("created_by")),
    p(
      "UPDATE",
      "authenticated",
      or(mgr, when(own("created_by"), (ctx) => ({ created_by: ctx.uid, status: { $in: ["draft", "returned_for_fix"] } }))),
      or(
        mgr,
        when(own("created_by"), (ctx) => ({
          created_by: ctx.uid,
          status: { $in: ["draft", "pending_approval", "returned_for_fix", "cancelled"] },
        })),
      ),
    ),
    p("DELETE", "authenticated", or(mgr, (ctx) => (ctx.uid ? { created_by: ctx.uid, status: "draft" } : null))),
  ),
  profiles: table(
    p("SELECT", "public", own("user_id")),
    p("SELECT", "public", sup),
    p("SELECT", "public", mgr),
    p("UPDATE", "public", own("user_id")),
    p("ALL", "public", sup),
    p("UPDATE", "public", mgr),
  ),
  proposal_client_forms: table(
    p("INSERT", "public", undefined, T),
    p("SELECT", "public", mgr),
    p("SELECT", "public", inIds("proposal_id", clientProposals)),
    p("INSERT", "public", undefined, inIds("proposal_id", clientProposals)),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  proposal_services: table(
    p("ALL", "public", inIds("proposal_id", createdProposals)),
    // is_manager OR can_access_proposal(proposal_id) (manager or proposal client)
    p("SELECT", "public", or(mgr, inIds("proposal_id", clientProposals))),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
  ),
  proposals: table(
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", mgr),
    p("SELECT", "public", mgr),
    p("SELECT", "public", own("created_by")),
    p("SELECT", "authenticated", or(own("client_user_id"), sup, mgr)),
  ),
  purchase_order_attachments: table(p("SELECT", "public", mgr), p("ALL", "public", mgr)),
  purchase_order_audit_log: table(p("SELECT", "public", mgr), p("INSERT", "authenticated", undefined, mgr)),
  purchase_orders: table(
    p("SELECT", "public", mgr),
    p("INSERT", "public", undefined, mgr),
    p("UPDATE", "public", mgr),
    p("DELETE", "public", sup),
  ),
  purchase_requests: table(
    p("SELECT", "authenticated", mgr),
    p("SELECT", "authenticated", own("user_id")),
    p("INSERT", "authenticated", undefined, own("user_id")),
    p("UPDATE", "authenticated", mgr),
    p("UPDATE", "authenticated", (ctx) => (ctx.uid ? { user_id: ctx.uid, status: "pending" } : null)),
    p("DELETE", "authenticated", mgr),
  ),
  push_subscriptions: table(p("ALL", "public", own("user_id"))),
  request_attachments: table(
    p("ALL", "public", sup),
    p("ALL", "public", mgr),
    p("ALL", "public", inIds("request_id", assignedRequests)),
  ),
  requests: table(
    p("ALL", "public", sup),
    p("ALL", "public", mgr),
    p("SELECT", "public", own("assigned_to")),
    p("UPDATE", "public", own("assigned_to")),
  ),
  satisfaction_responses: table(
    p("SELECT", "public", hasAnyRole("super_admin", "manager")),
    p("SELECT", "public", own("client_user_id")),
    p("INSERT", "public", undefined, own("client_user_id")),
  ),
  satisfaction_surveys: table(
    p("SELECT", "public", hasAnyRole("super_admin", "manager")),
    p("SELECT", "public", own("client_user_id")),
    p("ALL", "public", hasAnyRole("super_admin")),
  ),
  session_logs: table(
    p("SELECT", "public", own("user_id")),
    p("INSERT", "public", undefined, own("user_id")),
    p("UPDATE", "public", own("user_id")),
    p("SELECT", "public", mgr),
  ),
  shift_assignments: table(
    p("ALL", "authenticated", mgr),
    p("SELECT", "authenticated", or(own("user_id"), mgr)),
  ),
  shipping_addresses: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  site_allowed_items: table(p("ALL", "authenticated", mgr, mgr), p("SELECT", "authenticated", mgr)),
  supplier_catalog_items: table(p("ALL", "authenticated", mgr, mgr)),
  suppliers: table(p("ALL", "authenticated", mgr, mgr)),
  survey_templates: table(
    p("SELECT", "authenticated", eq("is_active", true)),
    p("ALL", "authenticated", mgr, mgr),
  ),
  system_settings: table(p("ALL", "public", sup), p("SELECT", "public", mgr)),
  team_members: table(
    p("SELECT", "public", mgr),
    p("ALL", "public", sup),
    p("SELECT", "public", own("user_id")),
  ),
  teams: table(
    p("SELECT", "public", mgr),
    p("ALL", "public", sup),
    p("SELECT", "public", or(inIds("_id", memberTeams), own("manager_id"))),
  ),
  user_module_permissions: table(
    p("SELECT", "public", own("user_id")),
    p("SELECT", "public", mgr),
    p("ALL", "public", sup),
  ),
  user_module_views: table(
    p("SELECT", "public", own("user_id")),
    p("INSERT", "public", undefined, own("user_id")),
    p("UPDATE", "public", own("user_id")),
  ),
  user_roles: table(
    p("SELECT", "public", own("user_id")),
    p("ALL", "public", sup),
    p("SELECT", "public", mgr),
  ),
  work_shifts: table(p("ALL", "authenticated", mgr), p("SELECT", "authenticated", mgr)),
  // Views run with owner rights (security_invoker = false) and are granted to anon + authenticated
  public_price_list: table(p("SELECT", "public", T)),
  public_survey_templates: table(p("SELECT", "public", T)),
  // security_invoker view over purchase_requests: same rules as the base table
  purchase_requests_employee: table(p("SELECT", "authenticated", mgr), p("SELECT", "authenticated", own("user_id"))),
};

export async function loadRoles(uid: string): Promise<string[]> {
  const rows = await getDb().collection("user_roles").find({ user_id: uid }).toArray();
  return rows.map((r) => r.role as string);
}

export { isManagerRole, isSuperAdmin };
