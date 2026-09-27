import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { existsSync, readdirSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bearerToken, verifyJwt } from "../auth/tokens.ts";
import { maybeCurrentProject, runInProject, setFallbackProject, type Project } from "../projects/context.ts";
import type { ProjectRequest } from "../routes/wrap.ts";

type Handler = (req: Request) => Response | Promise<Response>;

const handlers = new Map<string, Map<string, Handler>>();
let loadingName: string | null = null;

register("./esm-sh-hooks.mjs", import.meta.url);

function projectEnv(project: Project | null): Record<string, string | undefined> {
  if (!project) return process.env;
  return {
    ...process.env,
    ...project.functionEnv,
    SUPABASE_URL: project.apiUrl,
    SUPABASE_ANON_KEY: project.anonKey,
    SUPABASE_PUBLISHABLE_KEY: project.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: project.serviceRoleKey,
  };
}

// Minimal Deno surface used by the edge functions; env is resolved per project
(globalThis as any).Deno = {
  env: {
    get: (key: string) => projectEnv(maybeCurrentProject())[key],
    toObject: () => ({ ...projectEnv(maybeCurrentProject()) }),
  },
  serve: (a: unknown, b?: unknown) => {
    const handler = (typeof a === "function" ? a : typeof b === "function" ? b : (a as { handler: Handler }).handler) as Handler;
    const project = maybeCurrentProject();
    if (!loadingName || !project) throw new Error("Deno.serve called outside of function loading");
    handlers.get(project.name)!.set(loadingName, handler);
    return { finished: Promise.resolve(), shutdown: async () => {} };
  },
};

export async function loadFunctions(project: Project): Promise<string[]> {
  const dir = project.functionsDir;
  handlers.set(project.name, new Map());
  if (!existsSync(dir)) return [];
  setFallbackProject(project);
  try {
    for (const name of readdirSync(dir)) {
      const entry = path.join(dir, name, "index.ts");
      if (!existsSync(entry)) continue;
      loadingName = name;
      try {
        await runInProject(project, () => import(pathToFileURL(entry).href));
      } catch (err) {
        console.error(`[functions:${project.name}] failed to load ${name}:`, err);
      }
    }
  } finally {
    loadingName = null;
    setFallbackProject(null);
  }
  return [...handlers.get(project.name)!.keys()].sort();
}

async function toFetchRequest(req: ExpressRequest, project: Project): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const url = new URL(project.apiUrl);
  return new Request(`${url.origin}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: hasBody && Buffer.isBuffer(req.body) && req.body.length ? req.body : undefined,
  });
}

export const functionsRouter = express.Router();
functionsRouter.use(express.raw({ type: () => true, limit: "25mb" }));

functionsRouter.all("/:name", (req: ExpressRequest, res: ExpressResponse) => {
  const project = (req as ProjectRequest).project!;
  runInProject(project, async () => {
    const handler = handlers.get(project.name)?.get(req.params.name);
    if (!handler) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Requested function was not found" });
    }
    if (req.method !== "OPTIONS" && project.verifyJwt(req.params.name)) {
      const token = bearerToken(req);
      try {
        if (!token) throw new Error("missing");
        verifyJwt(token);
      } catch {
        return res.status(401).json({ code: 401, message: "Invalid JWT" });
      }
    }
    try {
      const response = await handler(await toFetchRequest(req, project));
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "content-length") res.setHeader(key, value);
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(`[functions:${project.name}] ${req.params.name} crashed:`, err);
      if (!res.headersSent) res.status(500).json({ error: (err as Error)?.message ?? "Function error" });
    }
  });
});
