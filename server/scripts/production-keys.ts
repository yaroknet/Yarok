/**
 * Prints a fresh JWT secret and the anon / service-role keys signed with it, for a hosted deployment.
 *   npm run keys:production
 * Backend service: JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
 * Website (static site): VITE_SUPABASE_PUBLISHABLE_KEY = the same ANON_KEY
 */
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

const secret = randomBytes(48).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600;
const sign = (role: string) => jwt.sign({ iss: "yarok", role, iat, exp }, secret);
const anon = sign("anon");

console.log("# Backend (Web Service) environment");
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${anon}`);
console.log(`SERVICE_ROLE_KEY=${sign("service_role")}`);
console.log("");
console.log("# Website (Static Site) environment");
console.log(`VITE_SUPABASE_PUBLISHABLE_KEY=${anon}`);
