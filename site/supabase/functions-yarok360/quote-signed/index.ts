import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { emailButton, emailDetails, emailLayout, escapeHtml, sendEmail } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ACCOUNTING_RECIPIENTS = [
  "feigi@yaroknet.co.il",
  "rotem@yaroknet.co.il",
  "office@yaroknet.co.il",
];

const MATERIAL_LABELS: Record<string, string> = {
  basic: "כולל חומרים בסיסיים",
  none: "ללא חומרים",
  toiletries: "טואלטיקה",
  bags: "שקיות",
  paper_towels: "מגבות נייר",
  toilet_paper: "נייר טואלט",
  other: "אחר",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId || typeof quoteId !== "string") {
      return new Response(JSON.stringify({ error: "quoteId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (error || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("quote_items")
      .select("description,frequency,price,sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order");

    const url = `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/employees/quote/${quote.unique_token}`;
    const totalFmt = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(quote.total_amount || 0));
    const itemsLines = (items || []).map((it) => `  • ${it.description} | ${it.frequency || ""} | ${Number(it.price).toLocaleString("he-IL")} ₪`).join("\n");
    const materialsLines = (quote.materials && quote.materials.length > 0)
      ? "\nחומרים:\n" + quote.materials.map((m: string) => `  • ${m === "other" ? "אחר: " + (quote.materials_other_text || "") : MATERIAL_LABELS[m] || m}`).join("\n")
      : "";

    const isNewClient = !!quote.client_details_filled_at;
    const newClientBlock = isNewClient
      ? `\n\n=== פרטי לקוח חדש (מילוי טופס) ===\nח.פ/ע.מ: ${quote.filled_vat_number || ""}\nכתובת חיוב: ${quote.filled_billing_address || ""}\nאיש קשר: ${quote.filled_contact_person || ""}\nטלפון משרד: ${quote.filled_office_phone || ""}\nאימייל: ${quote.filled_email || ""}`
      : "";

    const subject = `הצעת מחיר #${quote.quote_number} נחתמה — ${quote.network_name_snapshot}`;
    const body = `שלום,\n\nהצעת מחיר מספר #${quote.quote_number} נחתמה דיגיטלית.\n\n=== פרטי הלקוח ===\nרשת: ${quote.network_name_snapshot}${quote.branch_name ? "\nסניף: " + quote.branch_name : ""}\nאיש קשר: ${quote.contact_name || ""}\nטלפון: ${quote.contact_phone || ""}\nאימייל: ${quote.contact_email || ""}\n\n=== החותם ===\nשם: ${quote.signer_name || ""}\nת.ז: ${quote.signer_id_number || ""}\nתאריך חתימה: ${new Date(quote.signed_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}\n\n=== שירותים ===\n${itemsLines}${materialsLines}\n\nתנאי תשלום: ${quote.payment_terms}\nסה"כ: ${totalFmt}${newClientBlock}\n\nקישור להצעה החתומה: ${url}\nחתימה: ${quote.signature_data || ""}\n\nבברכה,\nמערכת קבוצת ירוק`;

    // The signature is a drawn image (data URL) or a link to one
    const signature = String(quote.signature_data || "");
    const sigMatch = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(signature);
    const attachments = sigMatch
      ? [{ filename: "signature.png", content: sigMatch[2], contentType: sigMatch[1], cid: "signature" }]
      : [];
    const signatureHtml = sigMatch
      ? `<p style="margin:0 0 16px"><b>חתימה:</b><br><img src="cid:signature" alt="חתימה" style="max-width:260px;border:1px solid #e5e7eb;background:#fff"></p>`
      : /^https?:\/\//.test(signature)
        ? `<p style="margin:0 0 16px"><b>חתימה:</b><br><img src="${escapeHtml(signature)}" alt="חתימה" style="max-width:260px;border:1px solid #e5e7eb"></p>`
        : "";
    const itemsHtml = (items || []).length
      ? `<p style="margin:0 0 6px"><b>שירותים:</b></p><ul style="margin:0 0 16px;padding-right:20px">${(items || [])
          .map((it) => `<li>${escapeHtml(it.description)} | ${escapeHtml(it.frequency || "")} | ${Number(it.price).toLocaleString("he-IL")} ₪</li>`)
          .join("")}</ul>`
      : "";
    const materialsText = (quote.materials || [])
      .map((m: string) => (m === "other" ? "אחר: " + (quote.materials_other_text || "") : MATERIAL_LABELS[m] || m))
      .join(", ");

    const html = emailLayout(
      `הצעת מחיר #${quote.quote_number} נחתמה`,
      `<p style="margin:0 0 16px">שלום,<br>הצעת מחיר מספר #${quote.quote_number} נחתמה דיגיטלית.</p>
<p style="margin:0 0 6px"><b>פרטי הלקוח</b></p>
${emailDetails([
  ["רשת", quote.network_name_snapshot],
  ["סניף", quote.branch_name],
  ["איש קשר", quote.contact_name],
  ["טלפון", quote.contact_phone],
  ["אימייל", quote.contact_email],
])}
<p style="margin:0 0 6px"><b>החותם</b></p>
${emailDetails([
  ["שם", quote.signer_name],
  ["ת.ז", quote.signer_id_number],
  ["תאריך חתימה", new Date(quote.signed_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })],
])}
${itemsHtml}
${emailDetails([
  ["חומרים", materialsText],
  ["תנאי תשלום", quote.payment_terms],
  ['סה"כ', totalFmt],
])}
${isNewClient
  ? `<p style="margin:0 0 6px"><b>פרטי לקוח חדש (מילוי טופס)</b></p>${emailDetails([
      ["ח.פ/ע.מ", quote.filled_vat_number],
      ["כתובת חיוב", quote.filled_billing_address],
      ["איש קשר", quote.filled_contact_person],
      ["טלפון משרד", quote.filled_office_phone],
      ["אימייל", quote.filled_email],
    ])}`
  : ""}
${signatureHtml}
${emailButton(url, "לצפייה בהצעה החתומה")}
<p style="margin:0">בברכה,<br>מערכת קבוצת ירוק</p>`,
    );
    const text = body.replace(/\nחתימה: .*$/m, "");

    const recipients = [...ACCOUNTING_RECIPIENTS];
    // Also notify the manager who created the quote, if notification_email set
    if (quote.notification_email && !recipients.includes(quote.notification_email)) recipients.push(quote.notification_email);

    const results: { recipient: string; status: number }[] = [];
    for (const recipient of recipients) {
      const sent = await sendEmail({ to: recipient, subject, html, text, attachments });
      if (!sent.ok) console.error(`Failed to notify ${recipient}:`, sent.error);
      results.push({ recipient, status: sent.status });
    }

    return new Response(JSON.stringify({ ok: true, recipients: ACCOUNTING_RECIPIENTS.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quote-signed error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
