import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config, PUBLIC_API_KEY } from "../../config.ts";
import { cronSecret, jwtSecret, serviceRoleKey } from "../keys.ts";
import { serviceContext, type RequestContext } from "../../policies.ts";
import { runInsert } from "../../postgrest/engine.ts";
import { parseQuery } from "../../postgrest/parse.ts";
import type { Project } from "../context.ts";
import { addViews, applyTriggers, rpc } from "./logic.ts";
import { isManagerRole, isSuperAdmin, loadRoles, policies } from "./policies.ts";
import { authUserReferences, tables } from "./schema.ts";
import { seeds } from "./seeds.ts";

applyTriggers(tables);
addViews(tables);

const dir = path.join(config.root, "site");

/** Functions with verify_jwt = false in supabase/config.toml */
function unverifiedFunctions(): Set<string> {
  const file = path.join(dir, "supabase", "config.toml");
  const out = new Set<string>();
  if (!existsSync(file)) return out;
  let current: string | null = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const section = /^\[functions\.([\w-]+)\]/.exec(line.trim());
    if (section) current = section[1];
    else if (/^\[/.test(line.trim())) current = null;
    else if (current && /^verify_jwt\s*=\s*false/.test(line.trim())) out.add(current);
  }
  return out;
}
const noJwt = unverifiedFunctions();

/** First folder of an object path, compared with auth.uid() by (storage.foldername(name))[1] */
const ownFolder = (ctx: RequestContext, p: string) => !!ctx.uid && p.split("/")[0] === ctx.uid;
const authed = (ctx: RequestContext) => ctx.role === "authenticated";
const cronSecretHeader = (): Record<string, string> => ({ "x-cron-secret": cronSecret() });

/** Website internal system (originally Supabase project bxbajdouhgafnvcfuput) */
export const siteProject: Project = {
  name: "site",
  label: "Yarok website",
  functionsDir: path.join(dir, "supabase", "functions"),
  dbName: config.mongoDb,
  apiUrl: `${config.apiUrl}/api/site`,
  jwtSecret: jwtSecret(),
  anonKey: PUBLIC_API_KEY,
  serviceRoleKey: serviceRoleKey(),
  tables,
  authUserReferences,
  policies,
  loadRoles,
  // public.handle_new_user()
  onUserCreated: async (u) => {
    await runInsert(
      "profiles",
      [{ user_id: u.id, full_name: (u.meta.full_name as string | undefined) ?? u.email ?? u.phone ?? "", email: u.email }],
      parseQuery(new URLSearchParams()),
      serviceContext(),
      { returning: false },
    );
  },
  // Storage buckets and access rules of the original project
  buckets: {
    documents: {
      public: false,
      canRead: (ctx, p) => isManagerRole(ctx) || ownFolder(ctx, p),
      canUpload: (ctx) => authed(ctx),
      canDelete: (ctx, p) => isSuperAdmin(ctx) || ownFolder(ctx, p),
    },
    photos: {
      public: false,
      canRead: (ctx, p) => ownFolder(ctx, p),
      canUpload: () => false,
      canDelete: (ctx) => isSuperAdmin(ctx),
    },
    signatures: {
      public: false,
      canRead: (ctx, p) => ownFolder(ctx, p),
      canUpload: () => false,
      canDelete: (ctx) => isSuperAdmin(ctx),
    },
    "complaint-attachments": {
      public: false,
      canRead: (ctx) => isManagerRole(ctx),
      canUpload: (ctx) => authed(ctx) && isManagerRole(ctx),
      canDelete: (ctx) => isManagerRole(ctx),
    },
    "purchase-order-attachments": {
      public: false,
      canRead: (ctx) => isManagerRole(ctx),
      canUpload: (ctx) => isManagerRole(ctx),
      canDelete: (ctx) => isManagerRole(ctx),
    },
    "client-logos": {
      public: true,
      canUpload: (ctx) => isManagerRole(ctx),
      canDelete: (ctx) => isManagerRole(ctx),
    },
    "proposal-signatures": {
      public: false,
      canRead: (ctx, p) => isManagerRole(ctx) || ownFolder(ctx, p),
      canUpload: (ctx) => authed(ctx) && !!ctx.uid,
    },
    "fleet-files": {
      public: false,
      canRead: (ctx) => isManagerRole(ctx),
      canUpload: (ctx) => isSuperAdmin(ctx),
      canDelete: (ctx) => isSuperAdmin(ctx),
    },
    "employee-documents": {
      public: false,
      canRead: (ctx) => isManagerRole(ctx),
      canUpload: () => false,
      canDelete: (ctx) => isSuperAdmin(ctx),
    },
  },
  seeds,
  // Scheduled jobs of the original project (UTC)
  cronJobs: [
    { fn: "fleet-alerts-cron", schedule: "0 5 * * *", timezone: "UTC", headers: cronSecretHeader },
    { fn: "fleet-km-cron", schedule: "30 5 * * *", timezone: "UTC", headers: cronSecretHeader },
  ],
  rpc,
  verifyJwt: (fn) => !noJwt.has(fn),
  functionEnv: {
    CRON_SECRET: cronSecret(),
    PUBLIC_APP_URL: config.siteUrl,
  },
};
