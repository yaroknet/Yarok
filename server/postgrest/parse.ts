import { PgError } from "./errors.ts";

export type SelectItem =
  | { kind: "star" }
  | { kind: "column"; name: string; alias?: string }
  | { kind: "embed"; relation: string; alias?: string; hint?: string; inner: boolean; spread: boolean; select: SelectItem[] };

export interface Condition {
  kind: "cond";
  column: string;
  op: string;
  value: string;
  negate: boolean;
}

export interface Logic {
  kind: "and" | "or";
  negate: boolean;
  children: FilterNode[];
}

export type FilterNode = Condition | Logic;

export interface OrderTerm {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

/** Splits on `sep` at parenthesis depth 0, honouring double-quoted values */
function splitTopLevel(input: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      const prev = i === 0 ? "" : input[i - 1];
      const next = i + 1 < input.length ? input[i + 1] : "";
      // Quotes only delimit when they wrap a whole value, so values like  כ"א  stay literal
      if (!quoted && (prev === "" || prev === sep || prev === "(" || prev === ".")) quoted = true;
      else if (quoted && (next === "" || next === sep || next === ")")) quoted = false;
      cur += ch;
      continue;
    }
    if (!quoted) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === sep && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function stripWhitespace(input: string): string {
  let out = "";
  let quoted = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && /\s/.test(ch)) continue;
    out += ch;
  }
  return out;
}

export function parseSelect(input: string | null): SelectItem[] {
  const raw = stripWhitespace(input ?? "*");
  if (raw === "" || raw === "*") return [{ kind: "star" }];
  return splitTopLevel(raw)
    .filter((p) => p !== "")
    .map(parseSelectItem);
}

function parseSelectItem(item: string): SelectItem {
  if (item === "*") return { kind: "star" };
  const parenIdx = item.indexOf("(");
  if (parenIdx !== -1 && item.endsWith(")")) {
    let head = item.slice(0, parenIdx);
    const inner = item.slice(parenIdx + 1, -1);
    let spread = false;
    if (head.startsWith("...")) {
      spread = true;
      head = head.slice(3);
    }
    let alias: string | undefined;
    const colon = head.indexOf(":");
    if (colon !== -1) {
      alias = head.slice(0, colon);
      head = head.slice(colon + 1);
    }
    const [relation, ...hints] = head.split("!");
    const isInner = hints.includes("inner");
    const hint = hints.find((h) => h !== "inner" && h !== "left");
    return { kind: "embed", relation, alias, hint, inner: isInner, spread, select: parseSelect(inner) };
  }
  let name = item;
  let alias: string | undefined;
  const colon = name.indexOf(":");
  if (colon !== -1 && name[colon + 1] !== ":") {
    alias = name.slice(0, colon);
    name = name.slice(colon + 1);
  }
  const cast = name.indexOf("::");
  if (cast !== -1) name = name.slice(0, cast);
  return { kind: "column", name: name.replace(/"/g, ""), alias };
}

function unquote(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  return v;
}

/** Parses "op.value" or "not.op.value" */
export function parseOperatorValue(column: string, expr: string): Condition {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  if (dot === -1) throw new PgError(400, "PGRST100", `failed to parse filter (${expr})`);
  let op = rest.slice(0, dot);
  const value = rest.slice(dot + 1);
  // Operator modifiers like eq(any) / like(all) are not used by this app
  const mod = op.indexOf("(");
  if (mod !== -1) op = op.slice(0, mod);
  return { kind: "cond", column, op, value, negate };
}

/** Parses the inside of or=(...) / and=(...) */
export function parseLogic(kind: "and" | "or", negate: boolean, expr: string): Logic {
  const trimmed = expr.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    throw new PgError(400, "PGRST100", `failed to parse logic tree (${expr})`);
  }
  const body = trimmed.slice(1, -1);
  const children = splitTopLevel(body).map(parseLogicItem);
  return { kind, negate, children };
}

function parseLogicItem(item: string): FilterNode {
  let s = item;
  let negate = false;
  if (s.startsWith("not.and(") || s.startsWith("not.or(")) {
    negate = true;
    s = s.slice(4);
  }
  if (s.startsWith("and(")) return parseLogic("and", negate, s.slice(3));
  if (s.startsWith("or(")) return parseLogic("or", negate, s.slice(2));
  const dot = s.indexOf(".");
  if (dot === -1) throw new PgError(400, "PGRST100", `failed to parse logic tree item (${item})`);
  return parseOperatorValue(s.slice(0, dot), s.slice(dot + 1));
}

export function parseOrder(expr: string): OrderTerm[] {
  return splitTopLevel(expr)
    .filter(Boolean)
    .map((term) => {
      const parts = term.split(".");
      const column = parts[0];
      const ascending = !parts.includes("desc");
      let nullsFirst = !ascending;
      if (parts.includes("nullsfirst")) nullsFirst = true;
      if (parts.includes("nullslast")) nullsFirst = false;
      return { column, ascending, nullsFirst };
    });
}

/** Splits an `in.(a,b,"c,d")` list into raw values */
export function parseList(value: string): string[] {
  const v = value.trim();
  const body = v.startsWith("(") && v.endsWith(")") ? v.slice(1, -1) : v;
  if (body === "") return [];
  return splitTopLevel(body).map(unquote);
}

export { unquote };

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

export interface ParsedQuery {
  select: SelectItem[];
  filters: FilterNode[];
  order: OrderTerm[];
  limit?: number;
  offset?: number;
  onConflict?: string[];
  /** Filters/order/limit targeting embedded resources, keyed by relation path */
  embedded: Record<string, { filters: FilterNode[]; order: OrderTerm[]; limit?: number; offset?: number }>;
}

export function parseQuery(params: URLSearchParams): ParsedQuery {
  const parsed: ParsedQuery = {
    select: parseSelect(params.get("select")),
    filters: [],
    order: [],
    embedded: {},
  };
  const embed = (path: string) => (parsed.embedded[path] ??= { filters: [], order: [] });

  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) continue;
    const lastDot = key.lastIndexOf(".");
    const path = lastDot === -1 ? "" : key.slice(0, lastDot);
    const leaf = lastDot === -1 ? key : key.slice(lastDot + 1);

    if (leaf === "or" || leaf === "and") {
      let negate = false;
      let p = path;
      if (p === "not" || p.endsWith(".not")) {
        negate = true;
        p = p === "not" ? "" : p.slice(0, -4);
      }
      const node = parseLogic(leaf, negate, value);
      (p ? embed(p).filters : parsed.filters).push(node);
      continue;
    }
    if (path && (leaf === "order" || leaf === "limit" || leaf === "offset")) {
      const target = embed(path);
      if (leaf === "order") target.order = parseOrder(value);
      else if (leaf === "limit") target.limit = Number(value);
      else target.offset = Number(value);
      continue;
    }
    if (path) {
      embed(path).filters.push(parseOperatorValue(leaf, value));
    } else {
      parsed.filters.push(parseOperatorValue(key, value));
    }
  }

  const order = params.get("order");
  if (order) parsed.order = parseOrder(order);
  const limit = params.get("limit");
  if (limit !== null) parsed.limit = Number(limit);
  const offset = params.get("offset");
  if (offset !== null) parsed.offset = Number(offset);
  const onConflict = params.get("on_conflict");
  if (onConflict) parsed.onConflict = onConflict.split(",").map((c) => c.trim().replace(/"/g, ""));
  return parsed;
}
