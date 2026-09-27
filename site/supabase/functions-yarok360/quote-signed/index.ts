import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/9y338278wlfgq47s1azirsyigpb9ke34";

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

    const url = `${SUPABASE_URL.replace(".supabase.co", ".lovable.app")}/quote/${quote.unique_token}`;
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

    const formData = isNewClient
      ? {
          vat_number: quote.filled_vat_number || null,
          billing_address: quote.filled_billing_address || null,
          contact_person: quote.filled_contact_person || null,
          office_phone: quote.filled_office_phone || null,
          email: quote.filled_email || null,
        }
      : null;

    // Send to all accounting recipients via Make.com (new structured format)
    for (const recipient of ACCOUNTING_RECIPIENTS) {
      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger_type: "quote_signed",
            is_new_client: isNewClient,
            recipient_email: recipient,
            client_name: quote.contact_name || quote.network_name_snapshot,
            pdf_download_url: url,
            form_data: formData,
            // Legacy fields kept for backwards compatibility with existing Make scenario
            type: "quote_signed_email",
            subject,
            body,
            quote_number: quote.quote_number,
            network_name: quote.network_name_snapshot,
            quote_url: url,
            signature_url: quote.signature_data,
          }),
        });
      } catch (e) {
        console.error(`Failed to notify ${recipient}:`, e);
      }
    }

    // Also notify the manager who created the quote, if notification_email set
    if (quote.notification_email && !ACCOUNTING_RECIPIENTS.includes(quote.notification_email)) {
      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger_type: "quote_signed",
            is_new_client: isNewClient,
            recipient_email: quote.notification_email,
            client_name: quote.contact_name || quote.network_name_snapshot,
            pdf_download_url: url,
            form_data: formData,
            type: "quote_signed_email",
            subject,
            body,
            quote_number: quote.quote_number,
          }),
        });
      } catch (e) {
        console.error("Failed to notify manager:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, recipients: ACCOUNTING_RECIPIENTS.length }), {
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
