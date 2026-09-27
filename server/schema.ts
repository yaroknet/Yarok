import { randomUUID } from "node:crypto";
import type { Document, Filter } from "mongodb";
import { currentProject } from "./projects/context.ts";
import type { RequestContext } from "./policies.ts";

export type ColType =
  | "uuid"
  | "text"
  | "int"
  | "numeric"
  | "float"
  | "bool"
  | "timestamptz"
  | "date"
  | "time"
  | "json"
  | "text[]"
  | "int[]"
  | "uuid[]"
  | "date[]";

export interface ColumnDef {
  type: ColType;
  /** NOT NULL without a default: must be supplied on insert */
  required?: boolean;
  /** NOT NULL (with or without default) */
  notNull?: boolean;
  default?: () => unknown;
  /** Defaults that need async work (sequences, lookups) */
  sequence?: { name: string; start: number };
  generated?: (row: Record<string, any>) => unknown;
}

export interface ForeignKey {
  column: string;
  table: string;
  refColumn: string;
  onDelete: "cascade" | "set null" | "no action";
  name: string;
}

export type RowTrigger = (
  row: Record<string, any>,
  ctx: RequestContext,
  old?: Record<string, any>,
) => void | Promise<void>;

export interface TableDef {
  pk: string;
  /** MongoDB collection name when it differs from the table name */
  collection?: string;
  columns: Record<string, ColumnDef>;
  unique?: string[][];
  /** Partial unique indexes (CREATE UNIQUE INDEX ... WHERE ...), checked by the engine */
  partialUnique?: { name: string; cols: string[]; where: Filter<Document> }[];
  indexes?: string[][];
  foreignKeys?: ForeignKey[];
  /** BEFORE UPDATE trigger update_updated_at_column() */
  touchUpdatedAt?: boolean;
  /** BEFORE INSERT trigger: may mutate the row (column names, stored values) */
  beforeInsert?: RowTrigger;
  /** BEFORE UPDATE trigger: may mutate the new row */
  beforeUpdate?: RowTrigger;
  /** AFTER INSERT / UPDATE / DELETE trigger with owner rights */
  afterWrite?: (
    op: "INSERT" | "UPDATE" | "DELETE",
    row: Record<string, any> | null,
    old: Record<string, any> | null,
  ) => void | Promise<void>;
  /** Read-only view: rows (stored representation, pk in _id) computed on demand */
  view?: (ctx: RequestContext) => Promise<Document[]>;
}

export interface AuthUserReference {
  table: string;
  column: string;
  /** restrict = NO ACTION / RESTRICT: deleting a referenced user fails */
  onDelete: "cascade" | "set null" | "restrict";
}

// ---------------------------------------------------------------- column helpers

export const uuid = () => randomUUID();
export const now = () => new Date();
export const val =
  <T>(v: T) =>
  () =>
    Array.isArray(v) ? [...v] : v && typeof v === "object" ? structuredClone(v) : v;

export const idColumn: ColumnDef = { type: "uuid", notNull: true, default: uuid };
export const createdAt: ColumnDef = { type: "timestamptz", notNull: true, default: now };
export const updatedAt: ColumnDef = { type: "timestamptz", notNull: true, default: now };
export const req = (type: ColType): ColumnDef => ({ type, required: true, notNull: true });
export const opt = (type: ColType, def?: () => unknown): ColumnDef => ({ type, default: def });
export const nn = (type: ColType, def: () => unknown): ColumnDef => ({ type, notNull: true, default: def });

export function fk(table: string, column: string, refTable: string, onDelete: ForeignKey["onDelete"]): ForeignKey {
  return { column, table: refTable, refColumn: "id", onDelete, name: `${table}_${column}_fkey` };
}

// ---------------------------------------------------------------- lookups (current project)

export function getTable(name: string): TableDef | undefined {
  const tables = currentProject().tables;
  return Object.prototype.hasOwnProperty.call(tables, name) ? tables[name] : undefined;
}

/** MongoDB collection that stores `table` in the current project (non-table names pass through) */
export function collectionName(table: string): string {
  return getTable(table)?.collection ?? table;
}

/** Foreign keys pointing at `table` from other tables */
export function incomingForeignKeys(table: string): { from: string; fk: ForeignKey }[] {
  const out: { from: string; fk: ForeignKey }[] = [];
  for (const [name, def] of Object.entries(currentProject().tables)) {
    if (def.view) continue;
    for (const f of def.foreignKeys ?? []) {
      if (f.table === table) out.push({ from: name, fk: f });
    }
  }
  return out;
}
