import type { Filter, Document } from "mongodb";
import { getDb } from "./db.ts";
import { currentProject } from "./projects/context.ts";
import { MATCH_NONE } from "./postgrest/filter.ts";
import { collectionName } from "./schema.ts";

export type DbRole = "anon" | "authenticated" | "service_role";

export interface RequestContext {
  role: DbRole;
  uid: string | null;
  email: string | null;
  roles: Set<string>;
  cache: Map<string, Promise<unknown>>;
}

export type Operation = "select" | "insert" | "update" | "updateCheck" | "delete";
export type PolicyFn = (ctx: RequestContext) => Promise<Filter<Document> | null> | Filter<Document> | null;
export type TablePolicies = Partial<Record<Operation, PolicyFn>>;

export const ALL: Filter<Document> = {};

export function makeContext(role: DbRole, uid: string | null, roles: string[] = [], email: string | null = null): RequestContext {
  return { role, uid, email, roles: new Set(roles), cache: new Map() };
}

export const serviceContext = () => makeContext("service_role", null);

export const hasRole = (ctx: RequestContext, role: string) => !!ctx.uid && ctx.roles.has(role);

export function memo<T>(ctx: RequestContext, key: string, fn: () => Promise<T>): Promise<T> {
  if (!ctx.cache.has(key)) ctx.cache.set(key, fn());
  return ctx.cache.get(key) as Promise<T>;
}

export async function distinct(collection: string, field: string, filter: Filter<Document>): Promise<any[]> {
  return getDb().collection(collectionName(collection)).distinct(field, filter);
}

/** OR of permissive policies; falsy entries are policies that don't apply */
export function anyOf(...filters: (Filter<Document> | null | false | undefined | "")[]): Filter<Document> {
  const applicable = filters.filter((f): f is Filter<Document> => !!f);
  if (applicable.some((f) => Object.keys(f).length === 0)) return ALL;
  if (applicable.length === 0) return MATCH_NONE;
  if (applicable.length === 1) return applicable[0];
  return { $or: applicable };
}

/**
 * Returns the row filter a request must satisfy for `op` on `table`.
 * service_role bypasses RLS entirely, like in Supabase.
 */
export async function policyFilter(table: string, op: Operation, ctx: RequestContext): Promise<Filter<Document>> {
  if (ctx.role === "service_role") return ALL;
  const tablePolicies = currentProject().policies[table];
  if (!tablePolicies) return MATCH_NONE;
  // Without an explicit WITH CHECK, Postgres re-applies the USING expression to the new row
  const fn = op === "updateCheck" ? (tablePolicies.updateCheck ?? tablePolicies.update) : tablePolicies[op];
  if (!fn) return MATCH_NONE;
  return (await fn(ctx)) ?? MATCH_NONE;
}
