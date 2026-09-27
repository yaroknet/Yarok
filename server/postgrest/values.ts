import type { ColType, ColumnDef } from "../schema.ts";
import { PgError } from "./errors.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function scalarType(type: ColType): ColType {
  return type.endsWith("[]") ? (type.slice(0, -2) as ColType) : type;
}

/** Parses a Postgres array literal like {a,b,"c d"} */
export function parsePgArray(input: string): string[] {
  const s = input.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return [s];
  const body = s.slice(1, -1);
  if (body === "") return [];
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === "\\" && i + 1 < body.length) cur += body[++i];
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function castScalar(type: ColType, value: unknown, column: string): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "json":
      return value;
    case "time":
      return String(value);
    case "uuid":
    case "text":
      return typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
    case "int": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new PgError(400, "22P02", `invalid input syntax for type integer: "${value}"`);
      }
      return n;
    }
    case "numeric":
    case "float": {
      if (typeof value === "string" && value.trim() === "") {
        throw new PgError(400, "22P02", `invalid input syntax for type numeric: ""`);
      }
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (Number.isNaN(n)) throw new PgError(400, "22P02", `invalid input syntax for type numeric: "${value}"`);
      return n;
    }
    case "bool": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase();
      if (["true", "t", "1", "yes", "y", "on"].includes(s)) return true;
      if (["false", "f", "0", "no", "n", "off"].includes(s)) return false;
      throw new PgError(400, "22P02", `invalid input syntax for type boolean: "${value}"`);
    }
    case "timestamptz": {
      const d = value instanceof Date ? value : new Date(typeof value === "number" ? value : String(value));
      if (Number.isNaN(d.getTime())) {
        throw new PgError(400, "22007", `invalid input syntax for type timestamp with time zone: "${value}"`);
      }
      return d;
    }
    case "date": {
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      const s = String(value).trim();
      // Postgres ignores any time/zone part when casting text to date
      if (ISO_DATE.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) throw new PgError(400, "22007", `invalid input syntax for type date: "${value}"`);
      return d.toISOString().slice(0, 10);
    }
    default:
      throw new PgError(500, "XX000", `unsupported type for column ${column}`);
  }
}

/** Converts an incoming JSON value into its MongoDB representation */
export function toDb(def: ColumnDef, value: unknown, column: string): unknown {
  if (value === null || value === undefined) return null;
  if (def.type === "json") return value;
  if (def.type.endsWith("[]")) {
    const items = Array.isArray(value) ? value : typeof value === "string" ? parsePgArray(value) : [value];
    return items.map((v) => castScalar(scalarType(def.type), v, column));
  }
  return castScalar(def.type, value, column);
}

/** Casts a filter value from the query string to match the column's stored type */
export function castFilterValue(def: ColumnDef | undefined, value: string, column: string): unknown {
  if (!def) return value;
  if (def.type === "json") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return castScalar(scalarType(def.type), value, column);
}

function formatTimestamp(d: Date): string {
  return d.toISOString().replace("Z", "+00:00");
}

/** Converts a stored value into the JSON PostgREST would return */
export function fromDb(def: ColumnDef | undefined, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return formatTimestamp(value);
  if (Array.isArray(value)) return value.map((v) => (v instanceof Date ? formatTimestamp(v) : v));
  if (def?.type === "timestamptz" && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : formatTimestamp(d);
  }
  return value;
}
