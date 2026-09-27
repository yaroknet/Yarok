import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "mongodb";
import type { RequestContext, TablePolicies } from "../policies.ts";
import type { AuthUserReference, TableDef } from "../schema.ts";
import type { ChangeEvent } from "../events.ts";

export interface BucketConfig {
  public: boolean;
  canUpload: (ctx: RequestContext) => boolean | Promise<boolean>;
  canRead?: (ctx: RequestContext, path: string) => boolean | Promise<boolean>;
  canDelete?: (ctx: RequestContext, path: string) => boolean | Promise<boolean>;
}

export interface Seed {
  id: string;
  table: string;
  rows: Record<string, unknown>[];
  upsertOn?: string;
}

export interface CronJob {
  fn: string;
  schedule: string;
  /** Defaults to Asia/Jerusalem */
  timezone?: string;
  biweekly?: boolean;
  body?: unknown;
  /** Extra request headers (e.g. x-cron-secret) */
  headers?: () => Record<string, string>;
}

/** A Postgres function exposed through /rest/v1/rpc/<name> */
export type RpcHandler = (args: Record<string, any>, ctx: RequestContext) => Promise<unknown>;

export interface Project {
  name: string;
  label: string;
  /** Folder with the Deno edge functions (<name>/index.ts) */
  functionsDir: string;
  dbName: string;
  db?: Db;
  apiUrl: string;
  jwtSecret: string;
  anonKey: string;
  serviceRoleKey: string;
  tables: Record<string, TableDef>;
  authUserReferences: AuthUserReference[];
  policies: Record<string, TablePolicies>;
  loadRoles: (uid: string) => Promise<string[]>;
  onUserCreated: (user: { id: string; email: string | null; phone: string | null; meta: Record<string, unknown> }) => Promise<void>;
  buckets: Record<string, BucketConfig>;
  seeds: Seed[];
  cronJobs: CronJob[];
  rpc: Record<string, RpcHandler>;
  /** Supabase verifies JWTs before invoking a function unless verify_jwt = false */
  verifyJwt: (fn: string) => boolean;
  /** Replacement for pg_net database triggers (only with ENABLE_DB_TRIGGERS=true) */
  onChange?: (event: ChangeEvent) => void;
  /** Extra env visible to edge functions through Deno.env.get */
  functionEnv: Record<string, string>;
}

const als = new AsyncLocalStorage<Project>();
let fallback: Project | null = null;

export function currentProject(): Project {
  const p = als.getStore() ?? fallback;
  if (!p) throw new Error("No project in context");
  return p;
}

export function maybeCurrentProject(): Project | null {
  return als.getStore() ?? fallback;
}

export function runInProject<T>(project: Project, fn: () => T): T {
  return als.run(project, fn);
}

/** Used while importing edge functions sequentially, where async context may not propagate */
export function setFallbackProject(project: Project | null) {
  fallback = project;
}
