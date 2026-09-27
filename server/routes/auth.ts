import express, { type Request, type Response, type NextFunction } from "express";
import { wrap } from "./wrap.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "../config.ts";
import { currentProject } from "../projects/context.ts";
import { getDb } from "../db.ts";
import { bearerToken, signJwt, verifyJwt } from "../auth/tokens.ts";
import {
  AuthError,
  createUser,
  deleteUser,
  toUserJson,
  updateUser,
  users,
  verifyPassword,
  type AuthUserDoc,
} from "../auth/users.ts";

interface RefreshTokenDoc {
  token: string;
  user_id: string;
  session_id: string;
  revoked: boolean;
  created_at: Date;
  revoked_at?: Date;
}

const refreshTokens = () => getDb().collection<RefreshTokenDoc>("auth_refresh_tokens");
/** Same reuse window GoTrue uses so concurrent refreshes from several tabs don't log the user out */
const REFRESH_REUSE_SECONDS = 10;

async function issueSession(user: AuthUserDoc, sessionId = randomUUID()) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + config.jwtExpirySeconds;
  const userJson = toUserJson(user);
  const accessToken = signJwt(
    {
      aud: "authenticated",
      exp: expiresAt,
      iat: now,
      iss: `${currentProject().apiUrl}/auth/v1`,
      sub: user._id,
      email: user.email ?? "",
      phone: user.phone ?? "",
      app_metadata: userJson.app_metadata,
      user_metadata: userJson.user_metadata,
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: sessionId,
      is_anonymous: false,
    },
  );
  const refreshToken = randomBytes(24).toString("base64url");
  await refreshTokens().insertOne({
    token: refreshToken,
    user_id: user._id,
    session_id: sessionId,
    revoked: false,
    created_at: new Date(),
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: config.jwtExpirySeconds,
    expires_at: expiresAt,
    refresh_token: refreshToken,
    user: userJson,
  };
}

const invalidCredentials = () => new AuthError(400, "invalid_credentials", "Invalid login credentials");

async function requireUser(req: Request): Promise<{ user: AuthUserDoc; sessionId?: string }> {
  const token = bearerToken(req);
  if (!token) throw new AuthError(401, "no_authorization", "This endpoint requires a Bearer token");
  let claims;
  try {
    claims = verifyJwt(token);
  } catch {
    throw new AuthError(403, "bad_jwt", "invalid JWT: unable to parse or verify signature, token is expired");
  }
  if (claims.role !== "authenticated" || !claims.sub) {
    throw new AuthError(403, "bad_jwt", "invalid claim: missing sub claim");
  }
  const user = await users().findOne({ _id: claims.sub });
  if (!user) throw new AuthError(403, "user_not_found", "User from sub claim in JWT does not exist");
  return { user, sessionId: claims.session_id };
}

function requireServiceRole(req: Request) {
  const token = bearerToken(req);
  try {
    if (token && verifyJwt(token).role === "service_role") return;
  } catch {
    // fall through
  }
  throw new AuthError(403, "not_admin", "User not allowed");
}

export const authRouter = express.Router();
authRouter.use(express.json({ limit: "1mb" }));

authRouter.get("/health", (_req, res) => res.json({ name: "GoTrue", version: "local-mongo", description: "local" }));

authRouter.get("/settings", (_req, res) =>
  res.json({
    external: { email: true, phone: true },
    disable_signup: true,
    mailer_autoconfirm: true,
    phone_autoconfirm: true,
  }),
);

authRouter.post(
  "/token",
  wrap(async (req, res) => {
    const grantType = req.query.grant_type;
    if (grantType === "password") {
      const { email, phone, password } = req.body ?? {};
      if (!password || (!email && !phone)) throw invalidCredentials();
      const user = email
        ? await users().findOne({ email: String(email).trim().toLowerCase() })
        : await users().findOne({ phone: String(phone).replace(/[\s\-()]/g, "") });
      if (!user || !(await verifyPassword(user, String(password)))) throw invalidCredentials();
      if (user.banned_until && user.banned_until > new Date()) throw new AuthError(400, "user_banned", "User is banned");
      await users().updateOne({ _id: user._id }, { $set: { last_sign_in_at: new Date() } });
      return res.json(await issueSession({ ...user, last_sign_in_at: new Date() }));
    }
    if (grantType === "refresh_token") {
      const token = req.body?.refresh_token;
      if (!token) throw new AuthError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      const stored = await refreshTokens().findOne({ token });
      if (!stored) throw new AuthError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      if (stored.revoked) {
        const age = (Date.now() - (stored.revoked_at?.getTime() ?? 0)) / 1000;
        if (age > REFRESH_REUSE_SECONDS) {
          throw new AuthError(400, "refresh_token_already_used", "Invalid Refresh Token: Already Used");
        }
      }
      const user = await users().findOne({ _id: stored.user_id });
      if (!user) throw new AuthError(400, "user_not_found", "User not found");
      await refreshTokens().updateOne({ token }, { $set: { revoked: true, revoked_at: new Date() } });
      return res.json(await issueSession(user, stored.session_id));
    }
    throw new AuthError(400, "unsupported_grant_type", "unsupported_grant_type");
  }),
);

authRouter.get(
  "/user",
  wrap(async (req, res) => {
    const { user } = await requireUser(req);
    res.json(toUserJson(user));
  }),
);

authRouter.put(
  "/user",
  wrap(async (req, res) => {
    const { user } = await requireUser(req);
    const { email, phone, password, data } = req.body ?? {};
    const updated = await updateUser(user._id, { email, phone, password, data });
    res.json(toUserJson(updated));
  }),
);

authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    const { user, sessionId } = await requireUser(req);
    const scope = (req.query.scope as string) || "global";
    const filter =
      scope === "local"
        ? { user_id: user._id, session_id: sessionId }
        : scope === "others"
          ? { user_id: user._id, session_id: { $ne: sessionId } }
          : { user_id: user._id };
    await refreshTokens().updateMany(filter as any, { $set: { revoked: true, revoked_at: new Date(0) } });
    res.status(204).end();
  }),
);

authRouter.post("/signup", (_req, res) => {
  res.status(422).json({ code: 422, error_code: "signup_disabled", msg: "Signups not allowed for this instance" });
});

authRouter.post("/recover", (_req, res) => res.json({}));

// ---------------------------------------------------------------- admin API (service_role only)

authRouter.get(
  "/admin/users",
  wrap(async (req, res) => {
    requireServiceRole(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.max(1, Number(req.query.per_page) || 50);
    const total = await users().countDocuments();
    const list = await users()
      .find()
      .sort({ created_at: 1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();
    res.setHeader("x-total-count", String(total));
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const links = [`</admin/users?page=${lastPage}&per_page=${perPage}>; rel="last"`];
    if (page < lastPage) links.unshift(`</admin/users?page=${page + 1}&per_page=${perPage}>; rel="next"`);
    res.setHeader("link", links.join(","));
    res.json({ aud: "authenticated", users: list.map(toUserJson) });
  }),
);

authRouter.post(
  "/admin/users",
  wrap(async (req, res) => {
    requireServiceRole(req);
    const b = req.body ?? {};
    const user = await createUser({
      email: b.email,
      phone: b.phone,
      password: b.password,
      email_confirm: b.email_confirm,
      phone_confirm: b.phone_confirm,
      user_metadata: b.user_metadata ?? b.data,
      app_metadata: b.app_metadata,
    });
    res.json(toUserJson(user));
  }),
);

authRouter.get(
  "/admin/users/:id",
  wrap(async (req, res) => {
    requireServiceRole(req);
    const user = await users().findOne({ _id: req.params.id });
    if (!user) throw new AuthError(404, "user_not_found", "User not found");
    res.json(toUserJson(user));
  }),
);

authRouter.put(
  "/admin/users/:id",
  wrap(async (req, res) => {
    requireServiceRole(req);
    const user = await updateUser(req.params.id, req.body ?? {});
    res.json(toUserJson(user));
  }),
);

authRouter.delete(
  "/admin/users/:id",
  wrap(async (req, res) => {
    requireServiceRole(req);
    await deleteUser(req.params.id);
    res.json({});
  }),
);

authRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AuthError) return res.status(err.status).json(err.toJSON());
  console.error("[auth]", err);
  res.status(500).json({ code: 500, error_code: "unexpected_failure", msg: "Unexpected failure" });
});
