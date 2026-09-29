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
  // "false" really sends WhatsApp and email; otherwise they are only logged (WEBHOOK_DRY_RUN is the old name)
  MESSAGING_DRY_RUN: local.MESSAGING_DRY_RUN || local.WEBHOOK_DRY_RUN || "true",
  ENABLE_CRON: local.ENABLE_CRON || "false",
  // Google AI Studio key for the AI assistant and fleet document reading (optional, free tier)
  GEMINI_API_KEY: local.GEMINI_API_KEY ?? "",
  // WhatsApp via Green API (optional): instance id and API token from console.green-api.com
  GREEN_API_URL: local.GREEN_API_URL || "https://api.green-api.com",
  GREEN_API_INSTANCE_ID: local.GREEN_API_INSTANCE_ID ?? "",
  GREEN_API_TOKEN: local.GREEN_API_TOKEN ?? "",
  // Email via the company mailbox (optional): Google Workspace smtp.gmail.com:465, Microsoft 365 smtp.office365.com:587
  SMTP_HOST: local.SMTP_HOST ?? "",
  SMTP_PORT: local.SMTP_PORT || "465",
  SMTP_SECURE: local.SMTP_SECURE || "true",
  SMTP_USER: local.SMTP_USER ?? "",
  SMTP_PASS: local.SMTP_PASS ?? "",
  SMTP_FROM: local.SMTP_FROM ?? "",
};
delete local.WEBHOOK_DRY_RUN;
// Keep any other settings already in .env.local
for (const [k, v] of Object.entries(local)) if (!(k in values)) values[k] = v;

writeFileSync(
  localPath,
  ["# Local backend settings (npm run setup)", ...Object.entries(values).map(([k, v]) => `${k}="${v}"`), ""].join("\n"),
);
console.log("Wrote .env.local");
