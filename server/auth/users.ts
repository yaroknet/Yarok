import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import { getDb } from "../db.ts";
import { emitChange } from "../events.ts";
import { currentProject, runInProject } from "../projects/context.ts";
import { cascadeDelete, docToRow } from "../postgrest/engine.ts";
import { collectionName, getTable } from "../schema.ts";

export interface AuthUserDoc {
  _id: string;
  email: string | null;
  phone: string | null;
  encrypted_password: string | null;
  email_confirmed_at: Date | null;
  phone_confirmed_at: Date | null;
  raw_user_meta_data: Record<string, unknown>;
  raw_app_meta_data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_sign_in_at: Date | null;
  banned_until: Date | null;
}

export class AuthError extends Error {
  status: number;
  errorCode: string;
  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
  toJSON() {
    return { code: this.status, error_code: this.errorCode, msg: this.message };
  }
}

export const users = () => getDb().collection<AuthUserDoc>("auth_users");

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

export function toUserJson(u: AuthUserDoc) {
  const providers = [u.email ? "email" : null, u.phone ? "phone" : null].filter(Boolean);
  return {
    id: u._id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email ?? "",
    email_confirmed_at: iso(u.email_confirmed_at),
    phone: u.phone ?? "",
    phone_confirmed_at: iso(u.phone_confirmed_at),
    confirmed_at: iso(u.email_confirmed_at ?? u.phone_confirmed_at),
    last_sign_in_at: iso(u.last_sign_in_at),
    app_metadata: { provider: providers[0] ?? "email", providers, ...u.raw_app_meta_data },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
    is_anonymous: false,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string" || email.trim() === "") return null;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw new AuthError(400, "validation_failed", "Unable to validate email address: invalid format");
  return e;
}

function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== "string" || phone.trim() === "") return null;
  const p = phone.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{7,15}$/.test(p)) throw new AuthError(400, "validation_failed", "Invalid phone number format (E.164 required)");
  return p;
}

function checkPassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6) {
    throw new AuthError(422, "weak_password", "Password should be at least 6 characters.");
  }
}

async function assertUnique(email: string | null, phone: string | null, exceptId?: string) {
  if (email && (await users().findOne({ email, _id: { $ne: exceptId ?? "" } }))) {
    throw new AuthError(422, "email_exists", "A user with this email address has already been registered");
  }
  if (phone && (await users().findOne({ phone, _id: { $ne: exceptId ?? "" } }))) {
    throw new AuthError(422, "phone_exists", "Phone number already registered by another user");
  }
}

export interface CreateUserInput {
  id?: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  encrypted_password?: string | null;
  email_confirm?: boolean;
  phone_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: Date;
}

export async function createUser(input: CreateUserInput): Promise<AuthUserDoc> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) throw new AuthError(400, "validation_failed", "Unable to validate email address: invalid format");
  let encrypted = input.encrypted_password ?? null;
  if (!encrypted && input.password !== undefined) {
    checkPassword(input.password);
    encrypted = await bcrypt.hash(input.password, 10);
  }
  await assertUnique(email, phone);
  const now = new Date();
  const doc: AuthUserDoc = {
    _id: input.id ?? randomUUID(),
    email,
    phone,
    encrypted_password: encrypted,
    email_confirmed_at: email && input.email_confirm !== false ? now : null,
    phone_confirmed_at: phone && input.phone_confirm !== false ? now : null,
    raw_user_meta_data: input.user_metadata ?? {},
    raw_app_meta_data: input.app_metadata ?? {},
    created_at: input.created_at ?? now,
    updated_at: now,
    last_sign_in_at: null,
    banned_until: null,
  };
  try {
    await users().insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      throw new AuthError(422, "email_exists", "A user with this email address has already been registered");
    }
    throw err;
  }
  await handleNewUser(doc);
  return doc;
}

/** on_auth_user_created trigger (public.handle_new_user) of the current project */
async function handleNewUser(u: AuthUserDoc) {
  await currentProject().onUserCreated({ id: u._id, email: u.email, phone: u.phone, meta: u.raw_user_meta_data ?? {} });
}

export interface UpdateUserInput {
  email?: string | null;
  phone?: string | null;
  password?: string;
  email_confirm?: boolean;
  phone_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  ban_duration?: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AuthUserDoc> {
  const existing = await users().findOne({ _id: id });
  if (!existing) throw new AuthError(404, "user_not_found", "User not found");
  const set: Partial<AuthUserDoc> = { updated_at: new Date() };
  if (input.email !== undefined) {
    set.email = normalizeEmail(input.email);
    if (set.email && input.email_confirm !== false) set.email_confirmed_at = new Date();
  }
  if (input.phone !== undefined) {
    set.phone = normalizePhone(input.phone);
    if (set.phone && input.phone_confirm !== false) set.phone_confirmed_at = new Date();
  }
  if (input.password !== undefined) {
    checkPassword(input.password);
    set.encrypted_password = await bcrypt.hash(input.password, 10);
  }
  const meta = input.user_metadata ?? input.data;
  if (meta) set.raw_user_meta_data = { ...existing.raw_user_meta_data, ...meta };
  if (input.app_metadata) set.raw_app_meta_data = { ...existing.raw_app_meta_data, ...input.app_metadata };
  if (input.ban_duration !== undefined) {
    set.banned_until = input.ban_duration === "none" ? null : new Date(Date.now() + parseDuration(input.ban_duration));
  }
  await assertUnique(set.email ?? null, set.phone ?? null, id);
  await users().updateOne({ _id: id }, { $set: set });
  return (await users().findOne({ _id: id }))!;
}

function parseDuration(s: string): number {
  const m = /^(\d+)(h|m|s)$/.exec(s);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === "h" ? n * 3600_000 : m[2] === "m" ? n * 60_000 : n * 1000;
}

export async function deleteUser(id: string) {
  const existing = await users().findOne({ _id: id });
  if (!existing) throw new AuthError(404, "user_not_found", "User not found");
  // Users are shared by every system on the platform, so apply each system's references
  const { projects } = await import("../projects/index.ts");
  const all = Object.values(projects);
  for (const project of all) {
    await runInProject(project, async () => {
      for (const ref of project.authUserReferences) {
        if (ref.onDelete === "restrict" && (await getDb().collection(collectionName(ref.table)).findOne({ [ref.column]: id }))) {
          throw new AuthError(500, "unexpected_failure", "Database error deleting user");
        }
      }
    });
  }
  for (const project of all) {
    await runInProject(project, async () => {
      const db = getDb();
      for (const ref of project.authUserReferences) {
        if (ref.onDelete === "restrict") continue;
        const def = getTable(ref.table)!;
        const affected = await db.collection(collectionName(ref.table)).find({ [ref.column]: id }).toArray();
        if (affected.length === 0) continue;
        if (ref.onDelete === "cascade") {
          const ids = affected.map((d) => d._id);
          await cascadeDelete(ref.table, ids);
          await db.collection(collectionName(ref.table)).deleteMany({ _id: { $in: ids } });
          for (const d of affected) emitChange(ref.table, "DELETE", null, docToRow(def, d));
        } else {
          await db.collection(collectionName(ref.table)).updateMany({ [ref.column]: id }, { $set: { [ref.column]: null } });
        }
      }
    });
  }
  await getDb().collection("auth_refresh_tokens").deleteMany({ user_id: id });
  await users().deleteOne({ _id: id });
}

export async function verifyPassword(user: AuthUserDoc, password: string): Promise<boolean> {
  if (!user.encrypted_password) return false;
  // Supabase/GoTrue hashes are bcrypt ($2a$), so imported hashes verify as-is
  return bcrypt.compare(password, user.encrypted_password);
}
