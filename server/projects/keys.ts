import jwt from "jsonwebtoken";
import { createHmac } from "node:crypto";
import { requiredEnv } from "../config.ts";

/** The only secret the backend needs; everything below is derived from it */
export const jwtSecret = () => requiredEnv("JWT_SECRET");

/** Full-access key used by the edge functions and scheduled jobs inside the backend */
export const serviceRoleKey = () =>
  jwt.sign({ iss: "yarok", role: "service_role" }, jwtSecret(), { algorithm: "HS256", noTimestamp: true });

/** Shared secret the scheduled fleet jobs check (x-cron-secret) */
export const cronSecret = () => process.env.CRON_SECRET || createHmac("sha256", jwtSecret()).update("cron").digest("hex");
