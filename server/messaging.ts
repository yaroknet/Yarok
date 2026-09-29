import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config.ts";

/**
 * The only place that sends WhatsApp (Green API) and email (SMTP with the company mailbox).
 * In dry-run mode (default) messages are printed to the console and reported as sent.
 */

export interface SendResult {
  ok: boolean;
  /** HTTP-like status: 200 on success, 4xx/5xx on failure, 0 when the service could not be reached */
  status: number;
  dryRun?: boolean;
  id?: string | null;
  error?: string;
}

export interface WhatsAppInput {
  phone: string;
  message?: string;
  /** Sends a file by link (Green API sendFileByUrl); message becomes its caption */
  fileUrl?: string;
  fileName?: string;
}

export interface EmailAttachment {
  filename: string;
  /** base64 content */
  content?: string;
  /** or a URL the server downloads */
  path?: string;
  contentType?: string;
  /** set to show the attachment inside the HTML as <img src="cid:..."> */
  cid?: string;
}

export interface EmailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

const TIMEOUT_MS = 20_000;

/** 05X-XXXXXXX / +972-5X... / 9725X... -> 9725XXXXXXXX; other international numbers are kept as digits */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `972${digits}`;
  if (digits.startsWith("9720")) digits = `972${digits.slice(4)}`;
  if (digits.startsWith("972")) return /^972\d{8,9}$/.test(digits) ? digits : null;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

const toList = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? String(v).split(/[,;]/) : []).map((s) => s.trim()).filter(Boolean);

const validEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s.replace(/^.*<([^>]+)>$/, "$1"));

export const whatsappConfigured = () => !!(config.greenApi.instanceId && config.greenApi.token);
export const emailConfigured = () => !!(config.smtp.host && config.smtp.user && config.smtp.pass);

export async function sendWhatsApp(input: WhatsAppInput): Promise<SendResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, status: 400, error: `Invalid phone number: ${input.phone}` };
  const chatId = `${phone}@c.us`;
  if (!input.message && !input.fileUrl) return { ok: false, status: 400, error: "Empty message" };

  if (config.messagingDryRun) {
    const what = input.fileUrl ? `file ${input.fileName ?? ""} ${input.fileUrl}\n${input.message ?? ""}` : input.message;
    console.log(`[messaging] DRY RUN — WhatsApp to ${chatId} not sent:\n${String(what).slice(0, 4000)}`);
    return { ok: true, status: 200, dryRun: true };
  }
  if (!whatsappConfigured()) {
    console.error("[messaging] WhatsApp not sent: GREEN_API_INSTANCE_ID / GREEN_API_TOKEN are not set");
    return { ok: false, status: 503, error: "WhatsApp is not configured" };
  }

  const { url, instanceId, token } = config.greenApi;
  const method = input.fileUrl ? "sendFileByUrl" : "sendMessage";
  const body = input.fileUrl
    ? { chatId, urlFile: input.fileUrl, fileName: input.fileName || "file.pdf", caption: input.message ?? "" }
    : { chatId, message: input.message };
  try {
    const res = await fetch(`${url}/waInstance${instanceId}/${method}/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text().catch(() => "");
    let id: string | null = null;
    try {
      id = (JSON.parse(text) as { idMessage?: string }).idMessage ?? null;
    } catch {
      // not JSON
    }
    if (!res.ok) {
      console.error(`[messaging] WhatsApp to ${chatId} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
      return { ok: false, status: res.status, error: text.slice(0, 500) || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, id };
  } catch (err) {
    console.error(`[messaging] WhatsApp to ${chatId} failed:`, (err as Error).message);
    return { ok: false, status: 0, error: (err as Error).message };
  }
}

let transporter: Transporter | null = null;
function smtp(): Transporter {
  if (!transporter) {
    const { host, port, secure, user, pass } = config.smtp;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      // Port 587 must upgrade with STARTTLS; a relay on this machine may be plain
      requireTLS: !secure && !["localhost", "127.0.0.1", "::1"].includes(host),
      auth: { user, pass },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: 60_000,
    });
  }
  return transporter;
}

export async function sendEmail(input: EmailInput): Promise<SendResult> {
  const to = toList(input.to);
  const cc = toList(input.cc);
  const bcc = toList(input.bcc);
  const bad = [...to, ...cc, ...bcc].filter((a) => !validEmail(a));
  if (!to.length) return { ok: false, status: 400, error: "No recipient" };
  if (bad.length) return { ok: false, status: 400, error: `Invalid email address: ${bad.join(", ")}` };
  if (!input.subject) return { ok: false, status: 400, error: "Missing subject" };
  if (!input.html && !input.text) return { ok: false, status: 400, error: "Empty email" };

  if (config.messagingDryRun) {
    const files = (input.attachments ?? []).map((a) => a.filename).join(", ");
    console.log(
      `[messaging] DRY RUN — email not sent\n  To: ${to.join(", ")}${cc.length ? `\n  Cc: ${cc.join(", ")}` : ""}` +
        `${bcc.length ? `\n  Bcc: ${bcc.join(", ")}` : ""}\n  Subject: ${input.subject}` +
        `${files ? `\n  Attachments: ${files}` : ""}\n${String(input.text ?? input.html).slice(0, 2000)}`,
    );
    return { ok: true, status: 200, dryRun: true };
  }
  if (!emailConfigured()) {
    console.error("[messaging] Email not sent: SMTP_HOST / SMTP_USER / SMTP_PASS are not set");
    return { ok: false, status: 503, error: "Email is not configured" };
  }

  try {
    const info = await smtp().sendMail({
      from: config.smtp.from,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: input.replyTo || undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: (input.attachments ?? []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        cid: a.cid,
        ...(a.content !== undefined ? { content: Buffer.from(a.content, "base64") } : { path: a.path }),
      })),
    });
    return { ok: true, status: 200, id: info.messageId ?? null };
  } catch (err) {
    const e = err as Error & { responseCode?: number; code?: string };
    console.error(`[messaging] Email to ${to.join(", ")} failed:`, e.message);
    // SMTP rejected the message (5xx) vs. could not connect / log in
    const status = e.responseCode && e.responseCode >= 500 ? 502 : e.code === "EAUTH" ? 401 : 0;
    return { ok: false, status, error: e.message };
  }
}

/** Checks the SMTP login without sending anything */
export async function verifyEmail(): Promise<SendResult> {
  if (config.messagingDryRun) return { ok: true, status: 200, dryRun: true };
  if (!emailConfigured()) return { ok: false, status: 503, error: "Email is not configured" };
  try {
    await smtp().verify();
    return { ok: true, status: 200 };
  } catch (err) {
    return { ok: false, status: 0, error: (err as Error).message };
  }
}

export function messagingStatus() {
  return { dryRun: config.messagingDryRun, whatsapp: whatsappConfigured(), email: emailConfigured() };
}

export function logMessagingMode() {
  const s = messagingStatus();
  if (s.dryRun) {
    console.log("[messaging] dry-run mode: WhatsApp and email are logged, not sent (MESSAGING_DRY_RUN=false to send)");
  } else {
    console.log(
      `[messaging] LIVE mode: WhatsApp ${s.whatsapp ? "via Green API" : "NOT configured"}, email ${s.email ? `via ${config.smtp.host}` : "NOT configured"}`,
    );
  }
}
