import type { Filter, Document } from "mongodb";
import { getDb } from "../../db.ts";
import { MATCH_NONE } from "../../postgrest/filter.ts";
import {
  ALL,
  anyOf,
  distinct,
  hasRole as has,
  memo,
  type PolicyFn,
  type RequestContext,
  type TablePolicies,
} from "../../policies.ts";

const ADMIN_ROLES = ["super_admin", "office_manager"];
/** אורית, מאיה, עוזי — hard-coded in the personal_tasks / team_tasks policies */
const BOARD_USER_IDS = [
  "d0175b71-1a13-4a93-93b2-d984738cf346",
  "78e34772-303e-469e-9771-a38aa93ddc2c",
  "5a5d0194-6ce1-448b-a1a7-da4466fcdffc",
];

export async function loadRoles(uid: string): Promise<string[]> {
  const rows = await getDb().collection("user_roles").find({ user_id: uid }).toArray();
  return rows.map((r) => r.role as string);
}

const isAdmin = (ctx: RequestContext) => has(ctx, "super_admin") || has(ctx, "office_manager");

const adminUserIds = (ctx: RequestContext) =>
  memo(ctx, "adminUserIds", () => distinct("user_roles", "user_id", { role: { $in: ADMIN_ROLES } }));
const workersOf = (ctx: RequestContext) =>
  memo(ctx, "workersOf", () => distinct("contractor_workers", "worker_id", { contractor_id: ctx.uid }));
const contractorsOf = (ctx: RequestContext) =>
  memo(ctx, "contractorsOf", () => distinct("contractor_workers", "contractor_id", { worker_id: ctx.uid }));
const customerNetworks = (ctx: RequestContext) =>
  memo(ctx, "customerNetworks", () => distinct("customer_network_access", "network_id", { user_id: ctx.uid }));

/** assigned_to values whose tasks each field role may see (mirrors the tasks policies) */
async function teamLeaderAssignees(ctx: RequestContext) {
  return [ctx.uid, ...(await contractorsOf(ctx)), ...(await workersOf(ctx))];
}
async function contractorAssignees(ctx: RequestContext) {
  return [ctx.uid, ...(await workersOf(ctx))];
}

async function fieldRoleAssigneeSets(ctx: RequestContext): Promise<string[][]> {
  const sets: string[][] = [];
  if (has(ctx, "team_leader")) sets.push(await teamLeaderAssignees(ctx));
  if (has(ctx, "contractor")) sets.push(await contractorAssignees(ctx));
  if (has(ctx, "contractor_worker")) sets.push([ctx.uid!]);
  return sets;
}

async function branchIdsForAssignees(assignees: string[]) {
  return distinct("tasks", "branch_id", { assigned_to: { $in: assignees } });
}

async function networkIdsForBranches(branchIds: string[]) {
  return distinct("branches", "network_id", { _id: { $in: branchIds } });
}

const customerCompletedTaskIds = (ctx: RequestContext) =>
  memo(ctx, "customerCompletedTaskIds", async () => {
    const networks = await customerNetworks(ctx);
    if (networks.length === 0) return [];
    const branches = await distinct("branches", "_id", { network_id: { $in: networks } });
    return distinct("tasks", "_id", { branch_id: { $in: branches }, status: "completed" });
  });

const adminOnly: PolicyFn = (ctx) => (isAdmin(ctx) ? ALL : MATCH_NONE);
const adminFullAccess: TablePolicies = {
  select: adminOnly,
  insert: adminOnly,
  update: adminOnly,
  delete: adminOnly,
};

export const policies: Record<string, TablePolicies> = {
  profiles: {
    select: async (ctx) =>
      anyOf(
        ctx.uid ? { user_id: ctx.uid } : null,
        isAdmin(ctx) && ALL,
        (has(ctx, "team_leader") || has(ctx, "contractor")) && { user_id: { $in: await adminUserIds(ctx) } },
        has(ctx, "contractor_worker") && {
          user_id: { $in: [...(await contractorsOf(ctx)), ...(await adminUserIds(ctx))] },
        },
      ),
    insert: (ctx) => anyOf(ctx.uid ? { user_id: ctx.uid } : null),
    update: (ctx) => anyOf(ctx.uid ? { user_id: ctx.uid } : null, isAdmin(ctx) && ALL),
  },

  user_roles: {
    select: (ctx) =>
      anyOf(
        ctx.uid ? { user_id: ctx.uid } : null,
        isAdmin(ctx) && ALL,
        (has(ctx, "team_leader") || has(ctx, "contractor") || has(ctx, "contractor_worker")) && {
          role: { $in: ADMIN_ROLES },
        },
      ),
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  networks: {
    select: async (ctx) => {
      const fieldNetworks: string[] = [];
      for (const assignees of await fieldRoleAssigneeSets(ctx)) {
        fieldNetworks.push(...(await networkIdsForBranches(await branchIdsForAssignees(assignees))));
      }
      return anyOf(
        isAdmin(ctx) && ALL,
        fieldNetworks.length > 0 && { _id: { $in: fieldNetworks } },
        ctx.uid ? { _id: { $in: await customerNetworks(ctx) } } : null,
      );
    },
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  branches: {
    select: async (ctx) => {
      const fieldBranches: string[] = [];
      for (const assignees of await fieldRoleAssigneeSets(ctx)) {
        fieldBranches.push(...(await branchIdsForAssignees(assignees)));
      }
      return anyOf(
        isAdmin(ctx) && ALL,
        fieldBranches.length > 0 && { _id: { $in: fieldBranches } },
        ctx.uid ? { network_id: { $in: await customerNetworks(ctx) } } : null,
      );
    },
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  tasks: {
    select: async (ctx) =>
      anyOf(
        isAdmin(ctx) && ALL,
        ...(await fieldRoleAssigneeSets(ctx)).map((a) => ({ assigned_to: { $in: a } })),
      ),
    insert: adminOnly,
    update: async (ctx) =>
      anyOf(
        isAdmin(ctx) && ALL,
        ...(await fieldRoleAssigneeSets(ctx)).map((a) => ({ assigned_to: { $in: a } })),
      ),
    delete: adminOnly,
  },

  field_reports: {
    select: async (ctx) =>
      anyOf(
        isAdmin(ctx) && ALL,
        (has(ctx, "team_leader") || has(ctx, "contractor") || has(ctx, "contractor_worker")) && {
          reported_by: ctx.uid,
        },
        has(ctx, "contractor") && { reported_by: { $in: await workersOf(ctx) } },
        ctx.uid ? { task_id: { $in: await customerCompletedTaskIds(ctx) } } : null,
      ),
    insert: (ctx) =>
      anyOf(
        (has(ctx, "team_leader") || has(ctx, "contractor") || has(ctx, "contractor_worker")) && {
          reported_by: ctx.uid,
        },
      ),
  },

  report_media: {
    select: async (ctx) => {
      if (!ctx.uid) return MATCH_NONE;
      const own = await distinct("field_reports", "_id", { reported_by: ctx.uid });
      const workerReports = has(ctx, "contractor")
        ? await distinct("field_reports", "_id", { reported_by: { $in: await workersOf(ctx) } })
        : [];
      const customerReports = await distinct("field_reports", "_id", {
        task_id: { $in: await customerCompletedTaskIds(ctx) },
      });
      return anyOf(
        isAdmin(ctx) && ALL,
        { field_report_id: { $in: own } },
        workerReports.length > 0 && { field_report_id: { $in: workerReports } },
        customerReports.length > 0 && { field_report_id: { $in: customerReports } },
      );
    },
    insert: async (ctx) =>
      ctx.uid
        ? { field_report_id: { $in: await distinct("field_reports", "_id", { reported_by: ctx.uid }) } }
        : MATCH_NONE,
  },

  customer_network_access: {
    select: (ctx) => anyOf(isAdmin(ctx) && ALL, ctx.uid ? { user_id: ctx.uid } : null),
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  internal_messages: {
    select: (ctx) =>
      anyOf(isAdmin(ctx) && ALL, ctx.uid ? { recipient_id: ctx.uid } : null, ctx.uid ? { sender_id: ctx.uid } : null),
    insert: (ctx) => anyOf(ctx.uid ? { sender_id: ctx.uid } : null),
    update: (ctx) => anyOf(ctx.uid ? { recipient_id: ctx.uid } : null),
  },

  services: adminFullAccess,

  whatsapp_log: {
    select: adminOnly,
    insert: adminOnly,
  },

  contractor_workers: {
    select: (ctx) =>
      anyOf(
        isAdmin(ctx) && ALL,
        has(ctx, "contractor") && { contractor_id: ctx.uid },
        has(ctx, "contractor_worker") && { worker_id: ctx.uid },
        has(ctx, "team_leader") && { $or: [{ contractor_id: ctx.uid }, { worker_id: ctx.uid }] },
      ),
    insert: (ctx) => anyOf(isAdmin(ctx) && ALL, has(ctx, "contractor") && { contractor_id: ctx.uid }),
    update: adminOnly,
    delete: (ctx) => anyOf(isAdmin(ctx) && ALL, has(ctx, "contractor") && { contractor_id: ctx.uid }),
  },

  whatsapp_schedule_config: adminFullAccess,
  whatsapp_templates: adminFullAccess,
  whatsapp_backlog: adminFullAccess,
  network_contacts: adminFullAccess,
  custom_reminders: adminFullAccess,
  price_list: adminFullAccess,

  service_start_proofs: {
    select: (ctx) => anyOf(isAdmin(ctx) && ALL, (has(ctx, "team_leader") || has(ctx, "contractor")) && ALL),
    insert: (ctx) => anyOf(ctx.uid ? { submitted_by: ctx.uid } : null),
  },

  personal_tasks: {
    select: (ctx) => boardOrAdmin(ctx),
    insert: (ctx) => boardOrAdmin(ctx),
    update: (ctx) => boardOrAdmin(ctx),
    delete: (ctx) => boardOrAdmin(ctx),
  },

  team_tasks: {
    select: (ctx) => boardOrAdmin(ctx),
    insert: (ctx) => boardOrAdmin(ctx),
    update: (ctx) => boardOrAdmin(ctx),
    delete: (ctx) => boardOrAdmin(ctx),
  },

  quotes: {
    select: () => ALL,
    insert: adminOnly,
    update: (ctx) => anyOf(isAdmin(ctx) && ALL, { status: { $ne: "signed" } }),
    updateCheck: (ctx) => anyOf(isAdmin(ctx) && ALL, { status: { $in: ["sent", "viewed", "signed"] } }),
    delete: adminOnly,
  },

  quote_items: {
    select: () => ALL,
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  quote_view_log: {
    select: adminOnly,
    insert: async () => ({ quote_id: { $in: await distinct("quotes", "_id", {}) } }),
  },
};

function boardOrAdmin(ctx: RequestContext): Filter<Document> {
  return anyOf(isAdmin(ctx) && ALL, ctx.uid && BOARD_USER_IDS.includes(ctx.uid) ? ALL : null);
}
