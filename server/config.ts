import dotenv from "dotenv";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

// Hosting platforms (Render) provide PORT and the service's public URL
const port = Number(process.env.PORT || process.env.API_PORT || 3001);

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Run "npm run setup" to generate .env.local`);
  return value;
}

export const config = {
  root,
  port,
  apiUrl: process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`,
  /** Public origin of the website (Vite dev server in development) */
  siteUrl: process.env.SITE_URL || "http://localhost:8090",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  /** One database for the whole platform */
  mongoDb: process.env.MONGODB_DB || "yarok",
  jwtExpirySeconds: Number(process.env.JWT_EXPIRY || 3600),
  enableCron: process.env.ENABLE_CRON === "true",
  enableDbTriggers: process.env.ENABLE_DB_TRIGGERS === "true",
  webhookDryRun: (process.env.WEBHOOK_DRY_RUN ?? process.env.WHATSAPP_DRY_RUN) !== "false",
};
