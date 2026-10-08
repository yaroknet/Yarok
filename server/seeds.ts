import { getDb } from "./db.ts";
import { serviceContext } from "./policies.ts";
import { currentProject } from "./projects/context.ts";
import { runInsert } from "./postgrest/engine.ts";
import { parseQuery } from "./postgrest/parse.ts";

/** Applies each of the current project's seed rows once */
export async function applySeeds() {
  const applied = getDb().collection<{ _id: string; applied_at: Date }>("_seeds");
  for (const seed of currentProject().seeds) {
    if (await applied.findOne({ _id: seed.id })) continue;
    if ("run" in seed) {
      await seed.run();
      await applied.insertOne({ _id: seed.id, applied_at: new Date() });
      continue;
    }
    const params = new URLSearchParams();
    if (seed.upsertOn) params.set("on_conflict", seed.upsertOn);
    await runInsert(seed.table, seed.rows, parseQuery(params), serviceContext(), {
      returning: false,
      upsert: seed.upsertOn ? "ignore" : undefined,
    });
    await applied.insertOne({ _id: seed.id, applied_at: new Date() });
  }
}
