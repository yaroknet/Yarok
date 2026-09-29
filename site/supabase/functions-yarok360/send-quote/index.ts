// Emails a quotation to the client from the company mailbox (admin clicks "send by email").
// Marks the quote as sent only when the email was accepted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { emailButton, emailDetails, emailLayout, escapeHtml, sendEmail } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATERIAL_LABELS: Record<string, string> = {
  basic: "כולל חומרים בסיסיים",
  none: "ללא חומרים",
  toiletries: "טואלטיקה",
  bags: "שקיות",
  paper_towels: "מגבות נייר",
  toilet_paper: "נייר טואלט",
  other: "אחר",
};

const ADMIN_ROLES = ["super_admin", "office_manager"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ils = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await supabase.auth.getUser(jwt);
    if (!auth?.user) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    if (!(roles || []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role))) return json({ error: "forbidden" }, 403);

    const { quoteId, recipientEmail } = await req.json();
    if (!quoteId || typeof quoteId !== "string") return json({ error: "quoteId required" }, 400);

    const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
    if (error || !quote) return json({ error: "Quote not found" }, 404);

    const { data: items } = await supabase
      .from("quote_items")
      .select("description,frequency,price,quantity,sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order");

    const quoteUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/employees/quote/${quote.unique_token}`;
    const target = (recipientEmail || quote.contact_email || "").trim();
    if (!target) return json({ error: "No recipient email available" }, 400);

    const isNewClient = !!quote.requires_client_details;
    const materials = (quote.materials || []).map((m: string) =>
      m === "other" ? `אחר: ${quote.materials_other_text || ""}` : (MATERIAL_LABELS[m] || m)
    );
    const rows = (items || []).map((it: { description: string; frequency: string | null; price: number; quantity?: number }) => ({
      description: it.description,
      frequency: it.frequency || "",
      quantity: Number(it.quantity ?? 1),
      price: Number(it.price),
    }));
    const total = Number(quote.total_amount || 0);
    const clientName = quote.contact_name || quote.network_name_snapshot || "";
    const subject = `הצעת מחיר #${quote.quote_number} מקבוצת ירוק — ${quote.network_name_snapshot}`;

    const th = "padding:8px;border:1px solid #e5e7eb;background:#eef6f1;text-align:right";
    const td = "padding:8px;border:1px solid #e5e7eb;text-align:right";
    const itemsHtml = rows.length
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:0 0 16px">
<tr><th style="${th}">שירות</th><th style="${th}">תדירות</th><th style="${th}">כמות</th><th style="${th}">מחיר</th></tr>
${rows.map((r) => `<tr><td style="${td}">${escapeHtml(r.description)}</td><td style="${td}">${escapeHtml(r.frequency)}</td><td style="${td}">${r.quantity}</td><td style="${td};white-space:nowrap">${ils(r.price)}</td></tr>`).join("\n")}
<tr><td colspan="3" style="${td};font-weight:bold">סה"כ</td><td style="${td};font-weight:bold;white-space:nowrap">${ils(total)}</td></tr>
</table>`
      : "";

    const html = emailLayout(
      `הצעת מחיר #${quote.quote_number}`,
      `<p style="margin:0 0 12px">שלום ${escapeHtml(clientName)},</p>
<p style="margin:0 0 16px">מצורפת הצעת המחיר של קבוצת ירוק עבור ${escapeHtml(quote.network_name_snapshot)}${quote.branch_name ? ` — ${escapeHtml(quote.branch_name)}` : ""}. ניתן לצפות בהצעה המלאה, להוריד אותה ולחתום עליה דיגיטלית בקישור:</p>
${emailButton(quoteUrl, "לצפייה וחתימה על ההצעה")}
${emailDetails([
  ["רשת", quote.network_name_snapshot],
  ["סניף", quote.branch_name],
  ["איש קשר", quote.contact_name],
  ["טלפון", quote.contact_phone],
  ["אימייל", quote.contact_email],
])}
${itemsHtml}
${emailDetails([
  ["חומרים", materials.join(", ")],
  ["תנאי תשלום", quote.payment_terms],
  ['סה"כ', ils(total)],
  ["הערות", quote.notes],
])}
${isNewClient ? `<p style="margin:0 0 12px">בעת החתימה תתבקשו למלא את פרטי הלקוח (ח.פ, כתובת לחיוב ואיש קשר).</p>` : ""}
<p style="margin:0 0 4px">אם הקישור לא נפתח, העתיקו אותו לדפדפן:</p>
<p style="margin:0 0 16px;direction:ltr;text-align:left;font-size:13px"><a href="${escapeHtml(quoteUrl)}">${escapeHtml(quoteUrl)}</a></p>
<p style="margin:0">בברכה,<br>קבוצת ירוק</p>`,
    );

    const text = [
      `שלום ${clientName},`,
      "",
      `מצורפת הצעת מחיר #${quote.quote_number} של קבוצת ירוק עבור ${quote.network_name_snapshot}${quote.branch_name ? ` — ${quote.branch_name}` : ""}.`,
      `לצפייה וחתימה: ${quoteUrl}`,
      "",
      ...rows.map((r) => `• ${r.description} | ${r.frequency} | ${r.quantity} | ${ils(r.price)}`),
      materials.length ? `חומרים: ${materials.join(", ")}` : "",
      `תנאי תשלום: ${quote.payment_terms || ""}`,
      `סה"כ: ${ils(total)}`,
      quote.notes ? `הערות: ${quote.notes}` : "",
      "",
      "בברכה,",
      "קבוצת ירוק",
    ].join("\n");

    console.log(`send-quote: quote #${quote.quote_number} -> ${target}`);
    const sent = await sendEmail({ to: target, subject, html, text });
    if (!sent.ok) {
      return json({ error: "Email sending failed", status: sent.status, body: sent.error ?? "" }, 502);
    }

    // Mark quote as sent (only flip from draft)
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("status", "draft");

    return json({ ok: true, recipient: target, quote_url: quoteUrl });
  } catch (e) {
    console.error("send-quote error:", e);
    return json({ error: String(e) }, 500);
  }
});
