import express, { type Request, type Response, type NextFunction } from "express";
import { wrap } from "./wrap.ts";
import { contextFromRequest } from "../auth/tokens.ts";
import { currentProject } from "../projects/context.ts";
import { runDelete, runInsert, runSelect, runUpdate } from "../postgrest/engine.ts";
import { PgError } from "../postgrest/errors.ts";
import { parseQuery } from "../postgrest/parse.ts";

type Row = Record<string, unknown>;

function queryParams(req: Request): URLSearchParams {
  const raw = req.originalUrl.split("?")[1] ?? "";
  return new URLSearchParams(raw);
}

function preferences(req: Request) {
  const prefer = String(req.headers.prefer ?? "")
    .split(",")
    .map((p) => p.trim());
  const count = prefer.find((p) => p.startsWith("count="))?.slice(6);
  const resolution = prefer.find((p) => p.startsWith("resolution="))?.slice(11);
  return {
    returning: prefer.includes("return=representation"),
    count: count === "exact" || count === "planned" || count === "estimated",
    upsert: resolution === "merge-duplicates" ? ("merge" as const) : resolution === "ignore-duplicates" ? ("ignore" as const) : undefined,
  };
}

function wantsObject(req: Request): boolean {
  return String(req.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
}

function singleRow(rows: Row[]): Row {
  if (rows.length !== 1) {
    throw new PgError(
      406,
      "PGRST116",
      "JSON object requested, multiple (or no) rows returned",
      `The result contains ${rows.length} rows`,
    );
  }
  return rows[0];
}

function contentRange(offset: number, returned: number, total: number | null): string {
  const totalPart = total === null ? "*" : String(total);
  if (returned === 0) return `*/${totalPart}`;
  return `${offset}-${offset + returned - 1}/${totalPart}`;
}

function rangeHeader(req: Request): { offset?: number; limit?: number } {
  const range = req.headers.range;
  const m = typeof range === "string" ? /^(\d+)-(\d*)$/.exec(range.trim()) : null;
  if (!m) return {};
  const offset = Number(m[1]);
  return m[2] === "" ? { offset } : { offset, limit: Number(m[2]) - offset + 1 };
}

export const restRouter = express.Router();
restRouter.use(express.json({ limit: "25mb", type: ["application/json", "application/*+json"] }));

const handleRead = wrap(async (req, res) => {
  const ctx = await contextFromRequest(req);
  const query = parseQuery(queryParams(req));
  const range = rangeHeader(req);
  if (query.offset === undefined && range.offset !== undefined) query.offset = range.offset;
  if (query.limit === undefined && range.limit !== undefined) query.limit = range.limit;
  const prefs = preferences(req);
  const head = req.method === "HEAD";
  const { rows, total } = await runSelect(req.params.table, query, ctx, { headOnly: head });
  const offset = query.offset ?? 0;
  const returned = head ? Math.max(0, Math.min(total - offset, query.limit ?? total)) : rows.length;
  res.setHeader("Content-Range", contentRange(offset, returned, prefs.count ? total : null));
  if (head) return res.status(200).end();
  if (wantsObject(req)) return res.status(200).json(singleRow(rows));
  res.status(200).json(rows);
});

restRouter.get("/:table", handleRead);
restRouter.head("/:table", handleRead);

restRouter.post(
  "/:table",
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const query = parseQuery(queryParams(req));
    const prefs = preferences(req);
    const body = req.body;
    if (body === undefined || body === null || typeof body !== "object") {
      throw new PgError(400, "PGRST102", "Empty or invalid json");
    }
    const inputs: Row[] = Array.isArray(body) ? body : [body];
    const rows = await runInsert(req.params.table, inputs, query, ctx, {
      returning: prefs.returning,
      upsert: prefs.upsert,
    });
    if (prefs.count) res.setHeader("Content-Range", `*/${inputs.length}`);
    if (!prefs.returning) return res.status(201).end();
    if (wantsObject(req)) return res.status(201).json(singleRow(rows));
    res.status(201).json(rows);
  }),
);

restRouter.patch(
  "/:table",
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const query = parseQuery(queryParams(req));
    const prefs = preferences(req);
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new PgError(400, "PGRST102", "Empty or invalid json");
    }
    const rows = await runUpdate(req.params.table, body, query, ctx, { returning: true });
    if (prefs.count) res.setHeader("Content-Range", `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
    if (!prefs.returning) return res.status(204).end();
    if (wantsObject(req)) return res.status(200).json(singleRow(rows));
    res.status(200).json(rows);
  }),
);

restRouter.delete(
  "/:table",
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const query = parseQuery(queryParams(req));
    const prefs = preferences(req);
    const rows = await runDelete(req.params.table, query, ctx, { returning: true });
    if (prefs.count) res.setHeader("Content-Range", `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
    if (!prefs.returning) return res.status(204).end();
    if (wantsObject(req)) return res.status(200).json(singleRow(rows));
    res.status(200).json(rows);
  }),
);

const handleRpc = wrap(async (req, res) => {
  const ctx = await contextFromRequest(req);
  const fn = currentProject().rpc[req.params.fn];
  if (!fn) {
    throw new PgError(404, "PGRST202", `Could not find the function public.${req.params.fn} in the schema cache`);
  }
  const args =
    req.method === "GET" || req.method === "HEAD"
      ? Object.fromEntries(queryParams(req).entries())
      : req.body && typeof req.body === "object"
        ? req.body
        : {};
  const result = await fn(args, ctx);
  if (req.method === "HEAD") return res.status(200).end();
  if (wantsObject(req) && Array.isArray(result)) return res.status(200).json(singleRow(result as Row[]));
  res.status(200).json(result ?? null);
});

restRouter.post("/rpc/:fn", handleRpc);
restRouter.get("/rpc/:fn", handleRpc);
restRouter.head("/rpc/:fn", handleRpc);

restRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof PgError) return res.status(err.status).json(err.toJSON());
  if (err instanceof SyntaxError) {
    return res.status(400).json({ code: "PGRST102", details: null, hint: null, message: "Empty or invalid json" });
  }
  console.error("[rest]", err);
  res.status(500).json({ code: "XX000", details: null, hint: null, message: (err as Error)?.message ?? "Internal error" });
});
