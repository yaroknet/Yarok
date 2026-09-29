// Emails a website contact-form inquiry to the office. Public (the website visitor is not logged in),
// so it only ever writes to the fixed office address and is rate limited per visitor.
import { emailDetails, emailLayout, sendEmail, textToHtml } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const visitor = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const hits = (recent.get(visitor) || []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= MAX_PER_WINDOW) return json({ error: "too_many_requests" }, 429);
    recent.set(visitor, [...hits, now]);

    const body = await req.json().catch(() => ({}));
    const name = clean(body?.name, 100);
    const phone = clean(body?.phone, 30);
    const email = clean(body?.email, 255);
    const message = clean(body?.message, 2000);
    if (!name || !message || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return json({ error: "invalid_input" }, 400);

    const to = Deno.env.get("CONTACT_FORM_TO") || "office@yaroknet.co.il";
    const receivedAt = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    const sent = await sendEmail({
      to,
      replyTo: email,
      subject: `פנייה חדשה מהאתר — ${name}`,
      html: emailLayout(
        "פנייה חדשה מטופס צור קשר",
        `${emailDetails([
          ["שם", name],
          ["טלפון", phone],
          ["אימייל", email],
          ["התקבל", receivedAt],
        ])}
<p style="margin:0 0 6px"><b>הודעה:</b></p>
${textToHtml(message)}`,
      ),
      text: `פנייה חדשה מטופס צור קשר\n\nשם: ${name}\nטלפון: ${phone}\nאימייל: ${email}\nהתקבל: ${receivedAt}\n\n${message}`,
    });
    if (!sent.ok) return json({ error: "email_failed", status: sent.status }, 502);
    return json({ ok: true });
  } catch (e) {
    console.error("contact-form error:", e);
    return json({ error: String(e) }, 500);
  }
});
