import { config } from "./config.ts";
import { changes, type ChangeEvent } from "./events.ts";
import { runInProject, type Project } from "./projects/context.ts";

/**
 * Replacement for Postgres triggers that POSTed row changes to edge functions via pg_net.
 * Only runs with ENABLE_DB_TRIGGERS=true.
 */
export function startDbTriggers(projects: Record<string, Project>) {
  if (!config.enableDbTriggers) return;
  changes.on("change", (e: ChangeEvent) => {
    const project = projects[e.project];
    if (project?.onChange) runInProject(project, () => project.onChange!(e));
  });
  console.log("[trigger] database webhook triggers enabled");
}

/** POSTs to one of the project's own edge functions, like net.http_post did */
export function postToFunction(project: Project, fn: string, body: unknown) {
  return fetch(`${project.apiUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${project.anonKey}` },
    body: JSON.stringify(body),
  }).catch((err) => console.error(`[trigger:${project.name}] ${fn} failed:`, err));
}
