import express, { type Request, type Response } from "express";
import { contextFromRequest } from "../auth/tokens.ts";
import { messagingStatus, sendEmail, sendWhatsApp, verifyEmail, type SendResult } from "../messaging.ts";
import { wrap } from "./wrap.ts";

/**
 * POST /messaging/v1/whatsapp  { phone, message } or { phone, fileUrl, fileName, message }
 * POST /messaging/v1/email     { to, cc?, bcc?, replyTo?, subject, html?, text?, attachments?: [{ filename, content (base64) | path, contentType? }] }
 * GET  /messaging/v1/status
 * POST /messaging/v1/email/verify
 * Only the server functions (service-role key) may call these; browser features go through a function
 * that checks the user's permissions first.
 */
export const messagingRouter = express.Router();
messagingRouter.use(express.json({ limit: "30mb" }));

const serviceOnly = (fn: (req: Request) => Promise<unknown>) =>
  wrap(async (req: Request, res: Response) => {
    let role = "anon";
    try {
      role = (await contextFromRequest(req)).role;
    } catch {
      // invalid token
    }
    if (role !== "service_role") return res.status(403).json({ ok: false, status: 403, error: "Service role key required" });
    const result = await fn(req);
    const status = (result as SendResult).status;
    // A failed send is a successful API call; callers read ok/status from the body
    res.status(typeof status === "number" && status >= 400 && status < 500 ? 400 : 200).json(result);
  });

messagingRouter.post("/whatsapp", serviceOnly((req) => sendWhatsApp(req.body ?? {})));
messagingRouter.post("/email", serviceOnly((req) => sendEmail(req.body ?? {})));
messagingRouter.post("/email/verify", serviceOnly(() => verifyEmail()));
messagingRouter.get("/status", serviceOnly(async () => ({ ok: true, ...messagingStatus() })));
