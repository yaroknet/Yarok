// Sends WhatsApp (Green API) and email (company SMTP mailbox) through the backend's messaging API.
// Used by the server functions of both the platform and Yarok 360; needs the service-role key.

export interface SendResult {
  ok: boolean;
  /** 200 on success, 4xx/5xx on failure, 0 when the backend could not be reached */
  status: number;
  dryRun?: boolean;
  id?: string | null;
  error?: string;
}

export interface EmailAttachment {
  filename: string;
  /** base64 content */
  content?: string;
  /** or a URL the backend downloads */
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
  /** Really sends even in dry-run mode, once SMTP is set */
  live?: boolean;
}

async function post(path: string, body: unknown): Promise<SendResult> {
  // Read per call: the module is shared by both projects
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const res = await fetch(`${base}/messaging/v1/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (data && typeof data.status === "number") return data as SendResult;
    return { ok: false, status: res.status || 0, error: `messaging API HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export const sendWhatsApp = (phone: string, message: string) => post("whatsapp", { phone, message });

export const sendWhatsAppFile = (phone: string, fileUrl: string, fileName: string, caption = "") =>
  post("whatsapp", { phone, fileUrl, fileName, message: caption });

export const sendEmail = (email: EmailInput) => post("email", email);

export const verifyEmailConnection = () => post("email/verify", {});

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text (with line breaks) as HTML paragraphs */
export const textToHtml = (text: string) =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

/** Hebrew right-to-left email frame with the company header */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f4;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" dir="rtl" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;text-align:right">
<tr><td style="background:#1f7a3f;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:bold">קבוצת ירוק</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">
<h1 style="font-size:19px;margin:0 0 16px;color:#1f7a3f">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:14px 24px;background:#f7f9f8;color:#6b7280;font-size:12px">ירוק שירותי אחזקה ניקיון וכח אדם בע"מ</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** A green call-to-action button */
export const emailButton = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1f7a3f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">${escapeHtml(label)}</a></p>`;

/** Two-column table of label/value rows (empty values are skipped) */
export function emailDetails(rows: Array<[string, unknown]>): string {
  const cells = rows
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;background:#f7f9f8;font-weight:bold;white-space:nowrap;border:1px solid #e5e7eb">${escapeHtml(k)}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return cells ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 16px;width:100%">${cells}</table>` : "";
}
