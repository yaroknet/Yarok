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

/** Every request without a login uses this public API key (like Supabase's anon key, but fixed and not secret) */
export const PUBLIC_API_KEY = "public";

export const config = {
  root,
  port,
  apiUrl: process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`,
  /** Public origin of the website (Vite dev server in development) */
  siteUrl: process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:8090",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  /** One database for the whole platform */
  mongoDb: process.env.MONGODB_DB || "yarok",
  jwtExpirySeconds: Number(process.env.JWT_EXPIRY || 3600),
  enableCron: process.env.ENABLE_CRON === "true",
  enableDbTriggers: process.env.ENABLE_DB_TRIGGERS === "true",
  /** WhatsApp and email are only logged unless MESSAGING_DRY_RUN=false (WEBHOOK_DRY_RUN is the old name) */
  messagingDryRun: (process.env.MESSAGING_DRY_RUN ?? process.env.WEBHOOK_DRY_RUN ?? process.env.WHATSAPP_DRY_RUN) !== "false",
  greenApi: {
    url: (process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/+$/, ""),
    instanceId: process.env.GREEN_API_INSTANCE_ID || "",
    token: process.env.GREEN_API_TOKEN || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 465),
    /** true = TLS from the start (port 465); false = STARTTLS (port 587) */
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT || 465) === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  },
};
