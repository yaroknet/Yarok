import type { Document, Filter } from "mongodb";
import { MongoServerError } from "mongodb";
import sift from "sift";
import { getDb, nextSequence } from "../db.ts";
import { emitChange } from "../events.ts";
import { policyFilter, type RequestContext } from "../policies.ts";
import { collectionName, getTable, incomingForeignKeys, type TableDef } from "../schema.ts";
import { PgError, rlsViolation } from "./errors.ts";
import { and, filtersToMongo } from "./filter.ts";
import type { FilterNode, OrderTerm, ParsedQuery, SelectItem } from "./parse.ts";
import { fromDb, toDb } from "./values.ts";

type Row = Record<string, unknown>;

export function requireTable(name: string): TableDef {
  const def = getTable(name);
  if (!def) {
    throw new PgError(404, "PGRST205", `Could not find the table 'public.${name}' in the schema cache`);
  }
  return def;
}

const collection = (name: string) => getDb().collection(collectionName(name));

/** Reads rows from a collection, or from a view computed in memory */
async function findDocs(table: string, def: TableDef, filter: Filter<Document>, ctx: RequestContext): Promise<Document[]> {
  if (def.view) {
    const rows = await def.view(ctx);
    return Object.keys(filter).length === 0 ? rows : rows.filter(sift(filter as any));
  }
  return collection(table).find(filter).toArray();
}

function rejectView(table: string, def: TableDef) {
  if (def.view) {
    throw new PgError(400, "55000", `cannot change view "${table}"`, "Views that are not simple are not automatically updatable.");
  }
}

/** Mongo field for a column: primary keys live in _id */
const fieldOf = (def: TableDef, column: string) => (column === def.pk ? "_id" : column);
const valueOf = (def: TableDef, doc: Document, column: string) => doc[fieldOf(def, column)];

export function docToRow(def: TableDef, doc: Document): Row {
  const row: Row = {};
  for (const [name, col] of Object.entries(def.columns)) row[name] = fromDb(col, valueOf(def, doc, name));
  return row;
}

function matches(filter: Filter<Document>, doc: Document): boolean {
  if (Object.keys(filter).length === 0) return true;
  return sift(filter as any)(doc);
}

// ---------------------------------------------------------------- sorting

function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function sortDocs(table: string, def: TableDef, docs: Document[], order: OrderTerm[]): Document[] {
  if (order.length === 0) return docs;
  for (const term of order) {
    if (!def.columns[term.column]) throw new PgError(400, "42703", `column ${table}.${term.column} does not exist`);
  }
  return [...docs].sort((x, y) => {
    for (const term of order) {
      const a = valueOf(def, x, term.column);
      const b = valueOf(def, y, term.column);
      const aNull = a === null || a === undefined;
      const bNull = b === null || b === undefined;
      if (aNull && bNull) continue;
      if (aNull || bNull) return aNull === term.nullsFirst ? -1 : 1;
      const c = compareValues(a, b);
      if (c !== 0) return term.ascending ? c : -c;
    }
    return 0;
  });
}

function paginate<T>(items: T[], limit?: number, offset?: number): T[] {
  const start = offset && offset > 0 ? offset : 0;
  return limit !== undefined && limit >= 0 ? items.slice(start, start + limit) : items.slice(start);
}

// ---------------------------------------------------------------- embedding

interface Relationship {
  kind: "many-to-one" | "one-to-many";
  /** column on the parent row (many-to-one) or on the child rows (one-to-many) */
  column: string;
}

function resolveRelationship(parent: string, parentDef: TableDef, relation: string, hint?: string): Relationship {
  const relDef = requireTable(relation);
  const hintMatches = (fk: { column: string; name: string }) => !hint || hint === fk.column || hint === fk.name;
  const m2o = (parentDef.foreignKeys ?? []).find((fk) => fk.table === relation && hintMatches(fk));
  if (m2o) return { kind: "many-to-one", column: m2o.column };
  const o2m = (relDef.foreignKeys ?? []).find((fk) => fk.table === parent && hintMatches(fk));
  if (o2m) return { kind: "one-to-many", column: o2m.column };
  throw new PgError(
    400,
    "PGRST200",
    `Could not find a relationship between '${parent}' and '${relation}' in the schema cache`,
  );
}

function validateColumns(table: string, def: TableDef, select: SelectItem[]) {
  for (const item of select) {
    if (item.kind === "column" && !def.columns[item.name]) {
      throw new PgError(400, "42703", `column ${table}.${item.name} does not exist`);
    }
  }
}

/** Projects docs according to `select`, resolving embedded resources with RLS applied */
async function buildRows(
  table: string,
  def: TableDef,
  docs: Document[],
  select: SelectItem[],
  ctx: RequestContext,
  embedded: ParsedQuery["embedded"],
  path = "",
): Promise<Row[]> {
  validateColumns(table, def, select);
  const embedValues = new Map<SelectItem, unknown[]>();

  for (const item of select) {
    if (item.kind !== "embed") continue;
    const relDef = requireTable(item.relation);
    const rel = resolveRelationship(table, def, item.relation, item.hint);
    const key = item.alias ?? item.relation;
    const embedPath = path ? `${path}.${key}` : key;
    const params = embedded[embedPath] ?? { filters: [] as FilterNode[], order: [] as OrderTerm[] };
    const rls = await policyFilter(item.relation, "select", ctx);
    const extra = filtersToMongo(item.relation, relDef, params.filters);

    if (rel.kind === "many-to-one") {
      const ids = [...new Set(docs.map((d) => valueOf(def, d, rel.column)).filter((v) => v != null))];
      const related = ids.length
        ? await findDocs(item.relation, relDef, and({ _id: { $in: ids } }, rls, extra), ctx)
        : [];
      const projected = await buildRows(item.relation, relDef, related, item.select, ctx, embedded, embedPath);
      const byId = new Map(related.map((d, i) => [d._id, projected[i]]));
      embedValues.set(
        item,
        docs.map((d) => byId.get(valueOf(def, d, rel.column)) ?? null),
      );
    } else {
      const ids = docs.map((d) => d._id);
      let related = ids.length
        ? await findDocs(item.relation, relDef, and({ [fieldOf(relDef, rel.column)]: { $in: ids } }, rls, extra), ctx)
        : [];
      related = sortDocs(item.relation, relDef, related, params.order);
      const projected = await buildRows(item.relation, relDef, related, item.select, ctx, embedded, embedPath);
      const groups = new Map<unknown, Row[]>();
      related.forEach((d, i) => {
        const k = valueOf(relDef, d, rel.column);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(projected[i]);
      });
      embedValues.set(
        item,
        docs.map((d) => paginate(groups.get(d._id) ?? [], params.limit, params.offset)),
      );
    }
  }

  const rows: Row[] = [];
  docs.forEach((doc, i) => {
    const row: Row = {};
    let keep = true;
    for (const item of select) {
      if (item.kind === "star") {
        Object.assign(row, docToRow(def, doc));
      } else if (item.kind === "column") {
        row[item.alias ?? item.name] = fromDb(def.columns[item.name], valueOf(def, doc, item.name));
      } else {
        const value = embedValues.get(item)![i];
        if (item.inner && (value === null || (Array.isArray(value) && value.length === 0))) keep = false;
        if (item.spread && value && !Array.isArray(value)) Object.assign(row, value);
        else row[item.alias ?? item.relation] = value;
      }
    }
    if (keep) rows.push(row);
  });
  return rows;
}

// ---------------------------------------------------------------- select

export interface SelectResult {
  rows: Row[];
  total: number;
}

export async function runSelect(
  table: string,
  query: ParsedQuery,
  ctx: RequestContext,
  opts: { headOnly?: boolean } = {},
): Promise<SelectResult> {
  const def = requireTable(table);
  validateColumns(table, def, query.select);
  const filter = and(filtersToMongo(table, def, query.filters), await policyFilter(table, "select", ctx));
  const all = sortDocs(table, def, await findDocs(table, def, filter, ctx), query.order);
  const page = paginate(all, query.limit, query.offset);
  if (opts.headOnly) return { rows: [], total: all.length };
  const rows = await buildRows(table, def, page, query.select, ctx, query.embedded);
  return { rows, total: all.length };
}

// ---------------------------------------------------------------- insert / upsert

function unknownColumn(table: string, column: string): PgError {
  return new PgError(400, "PGRST204", `Could not find the '${column}' column of '${table}' in the schema cache`);
}

function notNullViolation(table: string, column: string): PgError {
  return new PgError(400, "23502", `null value in column "${column}" of relation "${table}" violates not-null constraint`);
}

function applyGenerated(def: TableDef, doc: Document) {
  for (const [name, col] of Object.entries(def.columns)) {
    if (col.generated) {
      const named: Row = {};
      for (const c of Object.keys(def.columns)) named[c] = valueOf(def, doc, c);
      doc[fieldOf(def, name)] = col.generated(named);
    }
  }
}

async function buildInsertDoc(table: string, def: TableDef, input: Row): Promise<Document> {
  for (const key of Object.keys(input)) if (!def.columns[key]) throw unknownColumn(table, key);
  const doc: Document = {};
  for (const [name, col] of Object.entries(def.columns)) {
    if (col.generated) continue;
    let value: unknown;
    if (input[name] !== undefined) value = toDb(col, input[name], name);
    else if (col.sequence) value = await nextSequence(col.sequence.name, col.sequence.start);
    else if (col.default) value = toDb(col, col.default(), name);
    else value = null;
    doc[fieldOf(def, name)] = value ?? null;
  }
  applyGenerated(def, doc);
  return doc;
}

/** NOT NULL is enforced after BEFORE triggers ran, like Postgres */
function checkNotNull(table: string, def: TableDef, doc: Document) {
  for (const [name, col] of Object.entries(def.columns)) {
    const v = doc[fieldOf(def, name)];
    if (col.notNull && (v === null || v === undefined)) throw notNullViolation(table, name);
  }
}

function translateDuplicate(table: string, def: TableDef, err: MongoServerError): PgError {
  const keyPattern = Object.keys(err.keyPattern ?? {});
  const keyValue = err.keyValue ?? {};
  let constraint = `${table}_pkey`;
  let columns = [def.pk];
  if (!keyPattern.includes("_id")) {
    columns = keyPattern;
    constraint = `${table}_${keyPattern.join("_")}_key`;
  }
  const values = keyPattern.map((k) => String(keyValue[k]));
  return new PgError(
    409,
    "23505",
    `duplicate key value violates unique constraint "${constraint}"`,
    `Key (${columns.join(", ")})=(${values.join(", ")}) already exists.`,
  );
}

async function checkPartialUnique(table: string, def: TableDef, docs: Document[]) {
  for (const pu of def.partialUnique ?? []) {
    for (const doc of docs) {
      if (!matches(pu.where, doc)) continue;
      const key: Document = {};
      let complete = true;
      for (const c of pu.cols) {
        const v = valueOf(def, doc, c);
        if (v === null || v === undefined) complete = false;
        key[fieldOf(def, c)] = v;
      }
      if (!complete) continue;
      const clash = await collection(table).findOne(and(key, pu.where, { _id: { $ne: doc._id } }));
      if (clash) {
        throw new PgError(
          409,
          "23505",
          `duplicate key value violates unique constraint "${pu.name}"`,
          `Key (${pu.cols.join(", ")})=(${pu.cols.map((c) => String(valueOf(def, doc, c))).join(", ")}) already exists.`,
        );
      }
    }
  }
}

async function insertDocs(table: string, def: TableDef, docs: Document[]) {
  if (docs.length === 0) return;
  await checkPartialUnique(table, def, docs);
  try {
    await collection(table).insertMany(docs, { ordered: true });
  } catch (err) {
    // Postgres inserts are atomic: undo whatever part of the batch was written
    const ids = docs.map((d) => d._id);
    const written = await collection(table)
      .find({ _id: { $in: ids } })
      .project({ _id: 1 })
      .toArray();
    const preexisting = new Set<unknown>();
    if (err instanceof MongoServerError && err.code === 11000 && err.keyPattern?._id) {
      preexisting.add(err.keyValue?._id);
    }
    const toRemove = written.map((d) => d._id).filter((id) => !preexisting.has(id));
    if (toRemove.length) await collection(table).deleteMany({ _id: { $in: toRemove } });
    if (err instanceof MongoServerError && err.code === 11000) throw translateDuplicate(table, def, err);
    throw err;
  }
}

export interface MutationOptions {
  returning: boolean;
  upsert?: "merge" | "ignore";
}

export async function runInsert(
  table: string,
  inputs: Row[],
  query: ParsedQuery,
  ctx: RequestContext,
  opts: MutationOptions,
): Promise<Row[]> {
  const def = requireTable(table);
  rejectView(table, def);
  if (opts.returning) validateColumns(table, def, query.select);
  const anonymous = ctx.role === "anon";
  const insertCheck = await policyFilter(table, "insert", ctx);

  const toInsert: Document[] = [];
  const updated: { before: Document; after: Document; set: Document }[] = [];
  const resultIds: unknown[] = [];

  const conflictCols = query.onConflict ?? [def.pk];
  for (const input of inputs) {
    if (opts.upsert) {
      for (const key of Object.keys(input)) if (!def.columns[key]) throw unknownColumn(table, key);
      const conflictFilter: Document = {};
      let complete = true;
      for (const c of conflictCols) {
        if (!def.columns[c]) throw new PgError(400, "42703", `column "${c}" does not exist`);
        if (input[c] === undefined || input[c] === null) complete = false;
        else conflictFilter[fieldOf(def, c)] = toDb(def.columns[c], input[c], c);
      }
      const existing = complete ? await collection(table).findOne(conflictFilter) : null;
      if (existing) {
        if (opts.upsert === "ignore") continue;
        const updateUsing = await policyFilter(table, "update", ctx);
        if (!matches(updateUsing, existing)) throw rlsViolation(table, anonymous);
        const set: Document = {};
        for (const [key, value] of Object.entries(input)) {
          const col = def.columns[key];
          if (col.generated || key === def.pk) continue;
          set[key] = toDb(col, value, key);
        }
        if (def.touchUpdatedAt) set.updated_at = new Date();
        const after = { ...existing, ...set };
        await def.beforeUpdate?.(after, ctx, existing);
        applyGenerated(def, after);
        for (const name of Object.keys(def.columns)) {
          if (def.columns[name].notNull && (after[fieldOf(def, name)] === null || after[fieldOf(def, name)] === undefined)) {
            throw notNullViolation(table, name);
          }
        }
        if (!matches(await policyFilter(table, "updateCheck", ctx), after)) throw rlsViolation(table, anonymous);
        updated.push({ before: existing, after, set });
        resultIds.push(existing._id);
        continue;
      }
    }
    const doc = await buildInsertDoc(table, def, input);
    if (def.beforeInsert) {
      await def.beforeInsert(doc, ctx);
      applyGenerated(def, doc);
    }
    checkNotNull(table, def, doc);
    if (!matches(insertCheck, doc)) throw rlsViolation(table, anonymous);
    toInsert.push(doc);
    resultIds.push(doc._id);
  }

  await insertDocs(table, def, toInsert);
  await checkPartialUnique(table, def, updated.map((u) => u.after));
  for (const u of updated) {
    try {
      await collection(table).replaceOne({ _id: u.before._id }, u.after);
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) throw translateDuplicate(table, def, err);
      throw err;
    }
  }

  for (const doc of toInsert) {
    await def.afterWrite?.("INSERT", doc, null);
    emitChange(table, "INSERT", docToRow(def, doc), null);
  }
  for (const u of updated) {
    await def.afterWrite?.("UPDATE", u.after, u.before);
    emitChange(table, "UPDATE", docToRow(def, u.after), docToRow(def, u.before));
  }

  if (!opts.returning) return [];
  const docs = await collection(table)
    .find({ _id: { $in: resultIds as any[] } })
    .toArray();
  const byId = new Map(docs.map((d) => [d._id, d]));
  const ordered = resultIds.map((id) => byId.get(id)).filter((d): d is Document => !!d);
  return buildRows(table, def, ordered, query.select, ctx, query.embedded);
}

// ---------------------------------------------------------------- update

function requireWhere(query: ParsedQuery, verb: "UPDATE" | "DELETE") {
  if (query.filters.length === 0) {
    throw new PgError(400, "21000", `${verb} requires a WHERE clause`);
  }
}

export async function runUpdate(
  table: string,
  patch: Row,
  query: ParsedQuery,
  ctx: RequestContext,
  opts: MutationOptions,
): Promise<Row[]> {
  const def = requireTable(table);
  rejectView(table, def);
  requireWhere(query, "UPDATE");
  if (opts.returning) validateColumns(table, def, query.select);
  for (const key of Object.keys(patch)) if (!def.columns[key]) throw unknownColumn(table, key);

  const set: Document = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = def.columns[key];
    if (col.generated || value === undefined) continue;
    const v = toDb(col, value, key);
    if (v === null && col.notNull) throw notNullViolation(table, key);
    set[fieldOf(def, key)] = v;
  }

  const filter = and(
    filtersToMongo(table, def, query.filters),
    await policyFilter(table, "update", ctx),
    await policyFilter(table, "select", ctx),
  );
  const docs = sortDocs(table, def, await collection(table).find(filter).toArray(), query.order);
  const check = await policyFilter(table, "updateCheck", ctx);
  const now = new Date();

  const changes: { before: Document; after: Document }[] = [];
  for (const before of docs) {
    const after: Document = { ...before, ...set };
    if (def.touchUpdatedAt) after.updated_at = now;
    await def.beforeUpdate?.(after, ctx, before);
    applyGenerated(def, after);
    if (!matches(check, after)) throw rlsViolation(table, ctx.role === "anon");
    changes.push({ before, after });
  }
  await checkPartialUnique(table, def, changes.map((c) => c.after));

  for (const c of changes) {
    try {
      if (c.after._id !== c.before._id) {
        await collection(table).insertOne(c.after);
        await collection(table).deleteOne({ _id: c.before._id });
      } else {
        await collection(table).replaceOne({ _id: c.before._id }, c.after);
      }
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) throw translateDuplicate(table, def, err);
      throw err;
    }
    await def.afterWrite?.("UPDATE", c.after, c.before);
  }

  for (const c of changes) emitChange(table, "UPDATE", docToRow(def, c.after), docToRow(def, c.before));
  if (!opts.returning) return [];
  return buildRows(
    table,
    def,
    changes.map((c) => c.after),
    query.select,
    ctx,
    query.embedded,
  );
}

// ---------------------------------------------------------------- delete

/** Fails like Postgres when NO ACTION / RESTRICT references would be left dangling by a delete */
export async function assertDeletable(table: string, ids: unknown[], seen = new Set<string>()) {
  if (ids.length === 0) return;
  for (const { from, fk } of incomingForeignKeys(table)) {
    const childDef = getTable(from)!;
    const childField = fieldOf(childDef, fk.column);
    const children = await collection(from)
      .find({ [childField]: { $in: ids as any[] } })
      .project({ _id: 1 })
      .toArray();
    if (children.length === 0) continue;
    if (fk.onDelete === "no action") {
      throw new PgError(
        409,
        "23503",
        `update or delete on table "${table}" violates foreign key constraint "${fk.name}" on table "${from}"`,
        `Key (id)=(${String(ids[0])}) is still referenced from table "${from}".`,
      );
    }
    if (fk.onDelete === "cascade") {
      const key = `${from}:${children.map((c) => String(c._id)).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await assertDeletable(from, children.map((c) => c._id), seen);
    }
  }
}

/** Applies ON DELETE CASCADE / SET NULL for rows about to be removed. Runs with owner rights, like FK actions. */
export async function cascadeDelete(table: string, ids: unknown[]) {
  if (ids.length === 0) return;
  for (const { from, fk } of incomingForeignKeys(table)) {
    const childDef = getTable(from)!;
    const childField = fieldOf(childDef, fk.column);
    if (fk.onDelete === "cascade") {
      const children = await collection(from)
        .find({ [childField]: { $in: ids as any[] } })
        .toArray();
      if (children.length === 0) continue;
      const childIds = children.map((c) => c._id);
      await cascadeDelete(from, childIds);
      await collection(from).deleteMany({ _id: { $in: childIds } });
      for (const c of children) {
        await childDef.afterWrite?.("DELETE", null, c);
        emitChange(from, "DELETE", null, docToRow(childDef, c));
      }
    } else if (fk.onDelete === "set null") {
      const affected = await collection(from)
        .find({ [childField]: { $in: ids as any[] } })
        .toArray();
      if (affected.length === 0) continue;
      await collection(from).updateMany({ [childField]: { $in: ids as any[] } }, { $set: { [childField]: null } });
      for (const c of affected) {
        emitChange(from, "UPDATE", docToRow(childDef, { ...c, [childField]: null }), docToRow(childDef, c));
      }
    }
  }
}

export async function runDelete(
  table: string,
  query: ParsedQuery,
  ctx: RequestContext,
  opts: MutationOptions,
): Promise<Row[]> {
  const def = requireTable(table);
  rejectView(table, def);
  requireWhere(query, "DELETE");
  if (opts.returning) validateColumns(table, def, query.select);
  const filter = and(
    filtersToMongo(table, def, query.filters),
    await policyFilter(table, "delete", ctx),
    await policyFilter(table, "select", ctx),
  );
  const docs = sortDocs(table, def, await collection(table).find(filter).toArray(), query.order);
  const rows = opts.returning ? await buildRows(table, def, docs, query.select, ctx, query.embedded) : [];
  const ids = docs.map((d) => d._id);
  await assertDeletable(table, ids);
  await cascadeDelete(table, ids);
  if (ids.length) await collection(table).deleteMany({ _id: { $in: ids } });
  for (const d of docs) {
    await def.afterWrite?.("DELETE", null, d);
    emitChange(table, "DELETE", null, docToRow(def, d));
  }
  return rows;
}

/** Whether a row (API shape) is visible to ctx under the table's SELECT policy */
export async function canSee(table: string, row: Row, ctx: RequestContext): Promise<boolean> {
  const def = getTable(table);
  if (!def) return false;
  const doc: Document = {};
  for (const [name, col] of Object.entries(def.columns)) {
    const v = row[name];
    doc[fieldOf(def, name)] = v === null || v === undefined ? null : toDb(col, v, name);
  }
  return matches(await policyFilter(table, "select", ctx), doc);
}
