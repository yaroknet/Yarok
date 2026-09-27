import { config } from "./config.ts";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { startCron } from "./cron.ts";
import { connectProject } from "./db.ts";
import { installWebhookDryRun } from "./dry-run.ts";
import { functionsRouter, loadFunctions } from "./functions/runtime.ts";
import { runInProject } from "./projects/context.ts";
import { projects } from "./projects/index.ts";
import { attachRealtime } from "./realtime.ts";
import { authRouter } from "./routes/auth.ts";
import { restRouter } from "./routes/rest.ts";
import { storageRouter } from "./routes/storage.ts";
import type { ProjectRequest } from "./routes/wrap.ts";
import { applySeeds } from "./seeds.ts";
import { startDbTriggers } from "./triggers.ts";

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "prefer",
  "range",
  "accept",
  "accept-profile",
  "content-profile",
  "x-upsert",
  "x-supabase-api-version",
  "cache-control",
  "x-content-type",
  "x-region",
].join(", ");

async function main() {
  installWebhookDryRun();
  const loaded: string[] = [];
  for (const project of Object.values(projects)) {
    await connectProject(project);
    await runInProject(project, applySeeds);
    const fns = await loadFunctions(project);
    loaded.push(`${project.name}: ${fns.length} functions`);
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Total-Count, Link, x-supabase-api-version");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Links built by the Yarok 360 functions from SUPABASE_URL (was <project>.lovable.app/quote/...)
  app.get("/api/ops/quote/:token", (req, res) => res.redirect(`${config.siteUrl}/employees/quote/${req.params.token}`));

  const api = express.Router();
  api.use("/rest/v1", restRouter);
  api.use("/auth/v1", authRouter);
  api.use("/storage/v1", storageRouter);
  api.use("/functions/v1", functionsRouter);

  app.use(
    "/api/:project",
    (req: Request, res: Response, next: NextFunction) => {
      const project = projects[req.params.project];
      if (!project) return res.status(404).json({ message: `Unknown project "${req.params.project}"` });
      (req as ProjectRequest).project = project;
      next();
    },
    api,
  );

  // Old links: the employees area moved from /ops to /employees; public quote links are /quote/<token>
  app.get("/quote/:token", (req, res) => res.redirect(`/employees/quote/${req.params.token}`));
  app.get(["/ops", "/ops/*"], (req, res) => res.redirect(req.originalUrl.replace(/^\/ops/, "/employees")));

  // Built website (including the employees area). In development Vite serves it instead.
  const siteDist = path.join(config.root, "site", "dist");
  if (existsSync(path.join(siteDist, "index.html"))) {
    app.use(express.static(siteDist, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(siteDist, "index.html")));
  } else {
    app.get("*", (req, res) => res.redirect(`${config.siteUrl}${req.originalUrl}`));
  }

  const server = http.createServer(app);
  attachRealtime(server, projects);
  server.listen(config.port, () => {
    console.log(`[api] Yarok backend on ${config.apiUrl} (MongoDB ${config.mongoUri}/${config.mongoDb})`);
    for (const p of Object.values(projects)) console.log(`[api]   ${p.label}: ${p.apiUrl}`);
    console.log(`[functions] ${loaded.join(", ")}`);
    startCron(Object.values(projects));
    startDbTriggers(projects);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
