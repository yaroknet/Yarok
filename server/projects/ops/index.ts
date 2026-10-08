import path from "node:path";
import { config, PUBLIC_API_KEY } from "../../config.ts";
import { jwtSecret, serviceRoleKey } from "../keys.ts";
import { serviceContext, type RequestContext } from "../../policies.ts";
import { runInsert } from "../../postgrest/engine.ts";
import { parseQuery } from "../../postgrest/parse.ts";
import { postToFunction } from "../../triggers.ts";
import type { Project } from "../context.ts";
import { canEnterYarok360 } from "../yarok360.ts";
import { loadRoles, policies } from "./policies.ts";
import { authUserReferences, tables } from "./schema.ts";
import { seeds } from "./seeds.ts";

const isAdmin = (ctx: RequestContext) => ctx.roles.has("super_admin") || ctx.roles.has("office_manager");

/** Yarok 360 — field operations system (originally Supabase project qfbmelenrkipfuxgyame) */
export const opsProject: Project = {
  name: "ops",
  label: "Yarok 360",
  functionsDir: path.join(config.root, "site", "supabase", "functions-yarok360"),
  dbName: config.mongoDb,
  apiUrl: `${config.apiUrl}/api/ops`,
  jwtSecret: jwtSecret(),
  anonKey: PUBLIC_API_KEY,
  serviceRoleKey: serviceRoleKey(),
  tables,
  authUserReferences,
  policies,
  loadRoles,
  onUserCreated: async (u) => {
    await runInsert(
      "profiles",
      [{ user_id: u.id, full_name: (u.meta.full_name as string | undefined) ?? u.email ?? u.phone ?? "", email: u.email }],
      parseQuery(new URLSearchParams()),
      serviceContext(),
      { returning: false },
    );
  },
  // Storage buckets and upload rules of the original project
  buckets: {
    "field-media": {
      public: true,
      canUpload: (ctx) =>
        ctx.role === "service_role" || isAdmin(ctx) || ctx.roles.has("team_leader") || ctx.roles.has("contractor"),
    },
    "message-media": {
      public: true,
      canUpload: (ctx) => ctx.role === "service_role" || ctx.role === "authenticated",
    },
    "quote-files": {
      public: true,
      canUpload: () => true,
    },
  },
  seeds,
  // Schedule documented in the WhatsApp backlog (daily summaries 18:00, weekly Thursday 18:00)
  cronJobs: [
    { fn: "custom-reminder-runner", schedule: "* * * * *" },
    { fn: "personal-task-reminder", schedule: "*/5 * * * *" },
    { fn: "whatsapp-scheduler", schedule: "0 8-20 * * *" },
    { fn: "task-scheduler", schedule: "0 7 * * *" },
    { fn: "whatsapp-daily-summary", schedule: "0 18 * * *" },
    { fn: "whatsapp-daily-ilan", schedule: "0 18 * * *" },
    { fn: "service-form-reminder", schedule: "0 18 * * *" },
    { fn: "whatsapp-weekly-ilan", schedule: "0 18 * * 4" },
    { fn: "whatsapp-shaina-vitrines", schedule: "0 10 * * 0", biweekly: true },
  ],
  rpc: {
    can_enter_yarok360: async (_args, ctx) => canEnterYarok360(ctx),
  },
  verifyJwt: () => true,
  // notify_task_changed / notify_service_changed / notify_internal_message_whatsapp (disabled in the last migration)
  onChange: (e) => {
    if (e.table === "tasks" || e.table === "services") {
      postToFunction(opsProject, "task-created-webhook", {
        type: e.type,
        source: e.table === "tasks" ? "task" : "service",
        record: e.record,
        old_record: e.old_record,
      });
    } else if (e.table === "internal_messages" && e.type === "INSERT") {
      postToFunction(opsProject, "internal-message-whatsapp", { record: e.record });
    }
  },
  functionEnv: {
    PUBLIC_APP_URL: config.siteUrl,
  },
};
