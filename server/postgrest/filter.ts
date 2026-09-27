import type { Filter, Document } from "mongodb";
import type { TableDef } from "../schema.ts";
import { PgError } from "./errors.ts";
import type { Condition, FilterNode } from "./parse.ts";
import { parseList, unquote } from "./parse.ts";
import { castFilterValue, parsePgArray } from "./values.ts";

export const MATCH_NONE: Filter<Document> = { _id: { $in: [] } };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Converts a SQL LIKE pattern (also accepting PostgREST's * wildcard) into a RegExp */
export function likeToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) out += escapeRegex(pattern[++i]);
    else if (ch === "%" || ch === "*") out += "[\\s\\S]*";
    else if (ch === "_") out += "[\\s\\S]";
    else out += escapeRegex(ch);
  }
  return new RegExp(`^${out}$`, caseInsensitive ? "i" : "");
}

function columnDef(table: string, def: TableDef, column: string) {
  const col = def.columns[column];
  if (!col) throw new PgError(400, "42703", `column ${table}.${column} does not exist`);
  return col;
}

function field(def: TableDef, column: string): string {
  return column === def.pk ? "_id" : column;
}

function conditionToMongo(table: string, def: TableDef, c: Condition): Filter<Document> {
  const col = columnDef(table, def, c.column);
  const f = field(def, c.column);
  const cast = (v: string) => castFilterValue(col, unquote(v), c.column);
  const isArrayCol = col.type.endsWith("[]");

  let base: Filter<Document>;
  switch (c.op) {
    case "eq":
      base = { [f]: cast(c.value) };
      break;
    case "neq":
      base = { [f]: { $nin: [cast(c.value), null] } };
      break;
    case "gt":
      base = { [f]: { $gt: cast(c.value) } };
      break;
    case "gte":
      base = { [f]: { $gte: cast(c.value) } };
      break;
    case "lt":
      base = { [f]: { $lt: cast(c.value) } };
      break;
    case "lte":
      base = { [f]: { $lte: cast(c.value) } };
      break;
    case "like":
      base = { [f]: { $regex: likeToRegex(c.value, false) } };
      break;
    case "ilike":
      base = { [f]: { $regex: likeToRegex(c.value, true) } };
      break;
    case "match":
      base = { [f]: { $regex: new RegExp(c.value) } };
      break;
    case "imatch":
      base = { [f]: { $regex: new RegExp(c.value, "i") } };
      break;
    case "in":
      base = { [f]: { $in: parseList(c.value).map((v) => castFilterValue(col, v, c.column)) } };
      break;
    case "is": {
      const v = c.value.toLowerCase();
      if (v === "null" || v === "unknown") base = { [f]: null };
      else if (v === "true") base = { [f]: true };
      else if (v === "false") base = { [f]: false };
      else throw new PgError(400, "PGRST100", `failed to parse filter (is.${c.value})`);
      // IS / IS NOT never yields NULL, so negation is a plain complement
      return c.negate ? { $nor: [base] } : base;
    }
    case "cs": {
      const values = (c.value.startsWith("{") ? parsePgArray(c.value) : [c.value]).map((v) =>
        castFilterValue(col, v, c.column),
      );
      base = isArrayCol ? { [f]: { $all: values } } : { [f]: { $in: values } };
      break;
    }
    case "cd": {
      const values = parsePgArray(c.value).map((v) => castFilterValue(col, v, c.column));
      base = { $and: [{ [f]: { $ne: null } }, { [f]: { $not: { $elemMatch: { $nin: values } } } }] };
      break;
    }
    case "ov": {
      const values = (c.value.startsWith("{") ? parsePgArray(c.value) : parseList(c.value)).map((v) =>
        castFilterValue(col, v, c.column),
      );
      base = { [f]: { $in: values } };
      break;
    }
    default:
      throw new PgError(400, "PGRST100", `operator "${c.op}" is not supported`);
  }
  if (!c.negate) return base;
  // SQL three-valued logic: NOT (col op x) is false when col is NULL
  return { $and: [{ [f]: { $ne: null } }, { $nor: [base] }] };
}

export function filtersToMongo(table: string, def: TableDef, nodes: FilterNode[]): Filter<Document> {
  const parts = nodes.map((n) => nodeToMongo(table, def, n));
  return and(...parts);
}

function nodeToMongo(table: string, def: TableDef, node: FilterNode): Filter<Document> {
  if (node.kind === "cond") return conditionToMongo(table, def, node);
  const children = node.children.map((c) => nodeToMongo(table, def, c));
  const combined: Filter<Document> =
    children.length === 0 ? {} : node.kind === "and" ? { $and: children } : { $or: children };
  return node.negate ? { $nor: [combined] } : combined;
}

export function and(...filters: (Filter<Document> | null | undefined)[]): Filter<Document> {
  const parts = filters.filter((f): f is Filter<Document> => !!f && Object.keys(f).length > 0);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}
