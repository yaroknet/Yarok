import { MongoClient, type Db } from "mongodb";
import { config } from "./config.ts";
import { currentProject, type Project } from "./projects/context.ts";

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(config.mongoUri);
    await client.connect();
  }
  return client;
}

export async function connectProject(project: Project): Promise<Db> {
  if (project.db) return project.db;
  const db = (await getClient()).db(project.dbName);
  project.db = db;
  await ensureIndexes(project, db);
  return db;
}

export function getDb(): Db {
  const db = currentProject().db;
  if (!db) throw new Error(`Database for project "${currentProject().name}" not connected`);
  return db;
}

export async function closeDb() {
  await client?.close();
  client = null;
}

const BSON_TYPE: Record<string, string> = {
  uuid: "string",
  text: "string",
  date: "string",
  time: "string",
  int: "number",
  numeric: "number",
  float: "number",
  bool: "bool",
  timestamptz: "date",
};

async function ensureIndexes(project: Project, database: Db) {
  for (const [name, def] of Object.entries(project.tables)) {
    if (def.view) continue;
    const col = database.collection(def.collection ?? name);
    for (const unique of def.unique ?? []) {
      if (unique.length === 1 && unique[0] === def.pk) continue;
      const keys = Object.fromEntries(unique.map((k) => [k === def.pk ? "_id" : k, 1]));
      // Postgres UNIQUE ignores rows with a NULL in any key column; index only fully non-null rows
      const partial = Object.fromEntries(
        unique.map((k) => [k === def.pk ? "_id" : k, { $type: BSON_TYPE[def.columns[k]?.type] ?? "string" }]),
      );
      const options = { unique: true, name: `${name}_${unique.join("_")}_key`, partialFilterExpression: partial };
      try {
        await col.createIndex(keys, options);
      } catch (err) {
        const code = (err as { code?: number }).code;
        if (code !== 85 && code !== 86) throw err;
        await col.dropIndex(options.name);
        await col.createIndex(keys, options);
      }
    }
    for (const index of def.indexes ?? []) {
      await col.createIndex(Object.fromEntries(index.map((k) => [k, 1])));
    }
  }
  const users = database.collection("auth_users");
  await users.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
  await users.createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
  await database.collection("auth_refresh_tokens").createIndex({ token: 1 }, { unique: true });
}

export async function nextSequence(name: string, start: number): Promise<number> {
  const counters = getDb().collection<{ _id: string; value: number }>("counters");
  await counters.updateOne({ _id: name }, { $setOnInsert: { value: start - 1 } }, { upsert: true });
  const res = await counters.findOneAndUpdate({ _id: name }, { $inc: { value: 1 } }, { returnDocument: "after" });
  return res!.value;
}
