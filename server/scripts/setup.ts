/**
 * Creates .env.local (gitignored) for local development.
 * The only secret is JWT_SECRET; re-running keeps it unless --rotate is passed.
 */
import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const localPath = path.join(root, ".env.local");
const rotate = process.argv.includes("--rotate");
const local = existsSync(localPath) ? dotenv.parse(readFileSync(localPath)) : {};

const values: Record<string, string> = {
  MONGODB_URI: local.MONGODB_URI || "mongodb://127.0.0.1:27017",
  MONGODB_DB: local.MONGODB_DB || "yarok",
  JWT_SECRET: (!rotate && local.JWT_SECRET) || randomBytes(48).toString("base64url"),
  WEBHOOK_DRY_RUN: local.WEBHOOK_DRY_RUN || "true",
  ENABLE_CRON: local.ENABLE_CRON || "false",
  // Google AI Studio key for the AI assistant and fleet document reading (optional, free tier)
  GEMINI_API_KEY: local.GEMINI_API_KEY ?? "",
};
// Keep any other settings already in .env.local
for (const [k, v] of Object.entries(local)) if (!(k in values)) values[k] = v;

writeFileSync(
  localPath,
  ["# Local backend settings (npm run setup)", ...Object.entries(values).map(([k, v]) => `${k}="${v}"`), ""].join("\n"),
);
console.log("Wrote .env.local");
