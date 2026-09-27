import busboy from "busboy";
import express, { type Request, type Response, type NextFunction } from "express";
import { wrap } from "./wrap.ts";
import { GridFSBucket, type GridFSFile } from "mongodb";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { contextFromRequest, signJwt, verifyJwt } from "../auth/tokens.ts";
import { getDb } from "../db.ts";
import type { RequestContext } from "../policies.ts";
import { currentProject, type BucketConfig } from "../projects/context.ts";

const isAdmin = (ctx: RequestContext) => ctx.roles.has("super_admin") || ctx.roles.has("office_manager");
const isServiceRole = (ctx: RequestContext) => ctx.role === "service_role";

class StorageError extends Error {
  status: number;
  statusCode: string;
  error: string;
  constructor(status: number, error: string, message: string, statusCode = String(status)) {
    super(message);
    this.status = status;
    this.error = error;
    this.statusCode = statusCode;
  }
}

const gridfs = () => new GridFSBucket(getDb(), { bucketName: "storage" });
const filesCol = () => getDb().collection<GridFSFile>("storage.files");
const objectName = (bucket: string, path: string) => `${bucket}/${path.replace(/^\/+/, "")}`;

function requireBucket(name: string): BucketConfig {
  const b = currentProject().buckets[name];
  if (!b) throw new StorageError(404, "Bucket not found", "Bucket not found", "404");
  return b;
}

async function assertCanRead(ctx: RequestContext, bucket: string, path: string) {
  const config = requireBucket(bucket);
  if (isServiceRole(ctx)) return;
  const ok = config.canRead ? await config.canRead(ctx, path) : ctx.role !== "anon" || config.public;
  if (!ok) throw new StorageError(400, "not_found", "Object not found", "404");
}

async function findObject(bucket: string, path: string): Promise<GridFSFile | null> {
  return filesCol().findOne({ filename: objectName(bucket, path) }, { sort: { uploadDate: -1 } });
}

async function removeObjects(bucket: string, paths: string[]) {
  const fs = gridfs();
  const removed: string[] = [];
  for (const p of paths) {
    const files = await filesCol().find({ filename: objectName(bucket, p) }).toArray();
    for (const f of files) await fs.delete(f._id);
    if (files.length) removed.push(p);
  }
  return removed;
}

/** Reads the uploaded file from a multipart body (supabase-js default) or a raw body */
function readUpload(req: Request): Promise<{ stream: Readable; contentType: string; done: Promise<void> }> {
  const type = String(req.headers["content-type"] ?? "");
  if (!type.startsWith("multipart/form-data")) {
    return Promise.resolve({
      stream: req,
      contentType: type || "application/octet-stream",
      done: Promise.resolve(),
    });
  }
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });
    let resolved = false;
    const done = new Promise<void>((res, rej) => {
      bb.on("close", res);
      bb.on("error", rej);
    });
    bb.on("file", (_name, file, info) => {
      if (resolved) {
        file.resume();
        return;
      }
      resolved = true;
      resolve({ stream: file, contentType: info.mimeType || "application/octet-stream", done });
    });
    bb.on("close", () => {
      if (!resolved) reject(new StorageError(400, "Invalid request", "No file found in request"));
    });
    bb.on("error", reject);
    req.pipe(bb);
  });
}

async function handleUpload(req: Request, res: Response, forceUpsert: boolean) {
  const ctx = await contextFromRequest(req);
  const bucket = req.params.bucket;
  const path = req.params[0];
  const config = requireBucket(bucket);
  if (!(await config.canUpload(ctx))) {
    throw new StorageError(403, "Unauthorized", "new row violates row-level security policy", "403");
  }
  const upsert = forceUpsert || String(req.headers["x-upsert"]) === "true";
  const existing = await findObject(bucket, path);
  if (existing && !upsert) throw new StorageError(400, "Duplicate", "The resource already exists", "409");

  const { stream, contentType, done } = await readUpload(req);
  const upload = gridfs().openUploadStream(objectName(bucket, path), {
    metadata: {
      bucket,
      path,
      contentType: String(req.headers["x-content-type"] ?? "") || contentType,
      cacheControl: req.headers["cache-control"] ?? "max-age=3600",
      owner: ctx.uid,
    },
  });
  await pipeline(stream, upload);
  await done;
  if (existing) {
    const older = await filesCol()
      .find({ filename: objectName(bucket, path), _id: { $ne: upload.id } })
      .toArray();
    for (const f of older) await gridfs().delete(f._id);
  }
  res.json({ Key: objectName(bucket, path), Id: String(upload.id) });
}

async function streamObject(req: Request, res: Response, bucket: string, path: string, download?: string) {
  const file = await findObject(bucket, path);
  if (!file) throw new StorageError(400, "not_found", "Object not found", "404");
  const contentType = (file.metadata?.contentType as string) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", String(file.metadata?.cacheControl ?? "max-age=3600"));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("ETag", `"${file._id}"`);
  res.setHeader("Last-Modified", file.uploadDate.toUTCString());
  if (download !== undefined) {
    const name = download || path.split("/").pop() || "file";
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  const range = req.headers.range;
  const m = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : file.length - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : file.length - 1;
    start = Math.max(0, start);
    end = Math.min(end, file.length - 1);
    if (start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${file.length}`);
      return res.end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${file.length}`);
    res.setHeader("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return res.end();
    return pipeline(gridfs().openDownloadStream(file._id, { start, end: end + 1 }), res);
  }
  res.setHeader("Content-Length", String(file.length));
  if (req.method === "HEAD") return res.end();
  await pipeline(gridfs().openDownloadStream(file._id), res);
}

function signedPath(bucket: string, path: string, expiresIn: number) {
  const token = signJwt({ url: objectName(bucket, path) }, Math.max(1, Math.floor(expiresIn)));
  return `/object/sign/${objectName(bucket, path)}?token=${token}`;
}

export const storageRouter = express.Router();

storageRouter.get(
  "/bucket",
  wrap(async (_req, res) => {
    res.json(Object.entries(currentProject().buckets).map(([id, b]) => ({ id, name: id, public: b.public })));
  }),
);

storageRouter.get(
  "/bucket/:id",
  wrap(async (req, res) => {
    const b = requireBucket(req.params.id);
    res.json({ id: req.params.id, name: req.params.id, public: b.public });
  }),
);

const servePublic = wrap(async (req, res) => {
  const bucket = req.params.bucket;
  if (!requireBucket(bucket).public) throw new StorageError(400, "not_found", "Object not found", "404");
  await streamObject(req, res, bucket, req.params[0], req.query.download as string | undefined);
});
storageRouter.get("/object/public/:bucket/*", servePublic);
storageRouter.head("/object/public/:bucket/*", servePublic);

const serveSigned = wrap(async (req, res) => {
  const bucket = req.params.bucket;
  const path = req.params[0];
  const token = String(req.query.token ?? "");
  let claims: { url?: string };
  try {
    claims = verifyJwt(token) as { url?: string };
  } catch {
    throw new StorageError(400, "InvalidJWT", "jwt expired", "400");
  }
  if (claims.url !== objectName(bucket, path)) throw new StorageError(400, "InvalidSignature", "Invalid signature");
  await streamObject(req, res, bucket, path, req.query.download as string | undefined);
});
storageRouter.get("/object/sign/:bucket/*", serveSigned);
storageRouter.head("/object/sign/:bucket/*", serveSigned);

storageRouter.post(
  "/object/sign/:bucket/*",
  express.json(),
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const bucket = req.params.bucket;
    const path = req.params[0];
    await assertCanRead(ctx, bucket, path);
    if (!(await findObject(bucket, path))) throw new StorageError(400, "not_found", "Object not found", "404");
    res.json({ signedURL: signedPath(bucket, path, Number(req.body?.expiresIn) || 60) });
  }),
);

storageRouter.post(
  "/object/sign/:bucket",
  express.json(),
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const bucket = req.params.bucket;
    requireBucket(bucket);
    const expiresIn = Number(req.body?.expiresIn) || 60;
    const paths: string[] = req.body?.paths ?? [];
    const out = [];
    for (const p of paths) {
      let exists = await findObject(bucket, p);
      if (exists) {
        try {
          await assertCanRead(ctx, bucket, p);
        } catch {
          exists = null;
        }
      }
      out.push(
        exists
          ? { error: null, path: p, signedURL: signedPath(bucket, p, expiresIn) }
          : { error: "Either the object does not exist or you do not have access to it", path: p, signedURL: null },
      );
    }
    res.json(out);
  }),
);

storageRouter.post(
  "/object/list/:bucket",
  express.json(),
  wrap(async (req, res) => {
    await contextFromRequest(req);
    const bucket = req.params.bucket;
    requireBucket(bucket);
    const prefix = String(req.body?.prefix ?? "").replace(/^\/+|\/+$/g, "");
    const limit = Number(req.body?.limit) || 100;
    const offset = Number(req.body?.offset) || 0;
    const search = String(req.body?.search ?? "");
    const base = prefix ? `${bucket}/${prefix}/` : `${bucket}/`;
    const files = await filesCol()
      .find({ filename: { $regex: `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } })
      .sort({ filename: 1 })
      .toArray();
    const entries = new Map<string, any>();
    for (const f of files) {
      const rest = f.filename.slice(base.length);
      const [first, ...more] = rest.split("/");
      if (search && !first.includes(search)) continue;
      if (more.length > 0) {
        if (!entries.has(first)) entries.set(first, { name: first, id: null, updated_at: null, created_at: null, metadata: null });
      } else {
        entries.set(first, {
          name: first,
          id: String(f._id),
          updated_at: f.uploadDate.toISOString(),
          created_at: f.uploadDate.toISOString(),
          last_accessed_at: f.uploadDate.toISOString(),
          metadata: { size: f.length, mimetype: f.metadata?.contentType, cacheControl: f.metadata?.cacheControl },
        });
      }
    }
    res.json([...entries.values()].slice(offset, offset + limit));
  }),
);

const serveAuthenticated = wrap(async (req, res) => {
  const ctx = await contextFromRequest(req);
  await assertCanRead(ctx, req.params.bucket, req.params[0]);
  await streamObject(req, res, req.params.bucket, req.params[0], req.query.download as string | undefined);
});
storageRouter.get("/object/authenticated/:bucket/*", serveAuthenticated);
storageRouter.get("/object/:bucket/*", serveAuthenticated);

storageRouter.post("/object/:bucket/*", wrap((req, res) => handleUpload(req, res, false)));
storageRouter.put("/object/:bucket/*", wrap((req, res) => handleUpload(req, res, true)));

storageRouter.delete(
  "/object/:bucket",
  express.json(),
  wrap(async (req, res) => {
    const ctx = await contextFromRequest(req);
    const bucket = req.params.bucket;
    requireBucket(bucket);
    const config = requireBucket(bucket);
    const prefixes: string[] = req.body?.prefixes ?? [];
    const allowed: string[] = [];
    for (const p of prefixes) {
      const ok = isServiceRole(ctx) || (config.canDelete ? await config.canDelete(ctx, p) : isAdmin(ctx));
      if (ok) allowed.push(p);
    }
    const removed = await removeObjects(bucket, allowed);
    res.json(removed.map((p) => ({ name: p, bucket_id: bucket })));
  }),
);

storageRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return res.end();
  if (err instanceof StorageError) {
    return res.status(err.status).json({ statusCode: err.statusCode, error: err.error, message: err.message });
  }
  const status = (err as { status?: number })?.status;
  if (status === 401) {
    return res.status(400).json({ statusCode: "403", error: "Unauthorized", message: (err as Error).message });
  }
  console.error("[storage]", err);
  res.status(500).json({ statusCode: "500", error: "internal", message: (err as Error)?.message ?? "Internal error" });
});
