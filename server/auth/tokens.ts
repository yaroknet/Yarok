import type { Request } from "express";
import jwt from "jsonwebtoken";
import { PUBLIC_API_KEY } from "../config.ts";
import { currentProject } from "../projects/context.ts";
import { makeContext, type DbRole, type RequestContext } from "../policies.ts";
import { PgError } from "../postgrest/errors.ts";

export interface JwtClaims {
  sub?: string;
  role: DbRole;
  exp?: number;
  session_id?: string;
  email?: string;
  [key: string]: unknown;
}

export function signJwt(claims: Record<string, unknown>, expiresInSeconds?: number): string {
  return jwt.sign(claims, currentProject().jwtSecret, {
    algorithm: "HS256",
    ...(expiresInSeconds ? { expiresIn: expiresInSeconds } : {}),
  });
}

export function verifyJwt(token: string): JwtClaims {
  try {
    return jwt.verify(token, currentProject().jwtSecret, { algorithms: ["HS256"] }) as JwtClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new PgError(401, "PGRST303", "JWT expired");
    throw new PgError(401, "PGRST301", "JWSError JWSInvalidSignature");
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const apikey = req.headers.apikey;
  if (typeof apikey === "string" && apikey) return apikey;
  const queryKey = req.query.apikey;
  return typeof queryKey === "string" ? queryKey : null;
}

export async function contextFromToken(token: string | null): Promise<RequestContext> {
  if (!token) throw new PgError(401, "PGRST301", "No API key found in request");
  if (token === PUBLIC_API_KEY) return makeContext("anon", null);
  const claims = verifyJwt(token);
  if (claims.role === "service_role") return makeContext("service_role", null);
  if (claims.role === "authenticated" && claims.sub) {
    return makeContext(
      "authenticated",
      claims.sub,
      await currentProject().loadRoles(claims.sub),
      typeof claims.email === "string" && claims.email ? claims.email : null,
    );
  }
  return makeContext("anon", null);
}

export function contextFromRequest(req: Request): Promise<RequestContext> {
  return contextFromToken(bearerToken(req));
}
