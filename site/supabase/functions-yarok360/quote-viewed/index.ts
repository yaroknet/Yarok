import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { emailButton, emailDetails, emailLayout, escapeHtml, sendEmail } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      .select("id,quote_number,network_name_snapshot,branch_name,contact_name,notification_email,view_count,first_viewed_at,unique_token")
      .eq("id", quoteId)
      .maybeSingle();

    if (error || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify only on FIRST view (when first_viewed_at is null) and only if notification_email is set
    if (!quote.first_viewed_at && quote.notification_email) {
      const url = `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/employees/quote/${quote.unique_token}`;
      const subject = `הצעה #${quote.quote_number} נצפתה על ידי ${quote.network_name_snapshot}`;
      const viewedAt = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
      const body = `שלום,\n\nהלקוח ${quote.network_name_snapshot}${quote.branch_name ? " - " + quote.branch_name : ""} פתח את הצעת המחיר #${quote.quote_number}.\n\n${quote.contact_name ? "איש קשר: " + quote.contact_name + "\n" : ""}זמן: ${viewedAt}\n\nקישור להצעה: ${url}`;
      const html = emailLayout(
        `הצעה #${quote.quote_number} נצפתה`,
        `<p style="margin:0 0 16px">שלום,<br>הלקוח ${escapeHtml(quote.network_name_snapshot)}${quote.branch_name ? " - " + escapeHtml(quote.branch_name) : ""} פתח את הצעת המחיר #${quote.quote_number}.</p>
${emailDetails([
  ["איש קשר", quote.contact_name],
  ["זמן", viewedAt],
])}
${emailButton(url, "לצפייה בהצעה")}`,
      );

      const sent = await sendEmail({ to: quote.notification_email, subject, html, text: body });
      if (!sent.ok) console.error("Failed to send notification:", sent.error);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quote-viewed error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
