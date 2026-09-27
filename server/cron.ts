import cron from "node-cron";
import { config } from "./config.ts";
import type { Project } from "./projects/context.ts";

/**
 * Replacement for the pg_cron jobs that invoked scheduled edge functions.
 * Times are Israel time. Only runs with ENABLE_CRON=true.
 */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function invokeFunction(project: Project, fn: string, body: unknown = {}, headers: Record<string, string> = {}) {
  const res = await fetch(`${project.apiUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${project.serviceRoleKey}`, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

export function startCron(projects: Project[]) {
  if (!config.enableCron) return;
  let count = 0;
  for (const project of projects) {
    for (const job of project.cronJobs) {
      count++;
      cron.schedule(
        job.schedule,
        async () => {
          if (job.biweekly && isoWeek(new Date()) % 2 !== 0) return;
          try {
            const { status, body } = await invokeFunction(
              project,
              job.fn,
              job.body ?? { time: new Date().toISOString() },
              job.headers?.() ?? {},
            );
            console.log(`[cron:${project.name}] ${job.fn} -> ${status} ${body.slice(0, 200)}`);
          } catch (err) {
            console.error(`[cron:${project.name}] ${job.fn} failed:`, err);
          }
        },
        { timezone: job.timezone ?? "Asia/Jerusalem" },
      );
    }
  }
  console.log(`[cron] scheduled ${count} jobs (Asia/Jerusalem)`);
}
