import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/i30v7ry9t99adudo74r8yrbqkz5z9wcw";

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
      const url = `${SUPABASE_URL.replace(".supabase.co", ".lovable.app")}/quote/${quote.unique_token}`;
      const subject = `הצעה #${quote.quote_number} נצפתה על ידי ${quote.network_name_snapshot}`;
      const body = `שלום,\n\nהלקוח ${quote.network_name_snapshot}${quote.branch_name ? " - " + quote.branch_name : ""} פתח את הצעת המחיר #${quote.quote_number}.\n\n${quote.contact_name ? "איש קשר: " + quote.contact_name + "\n" : ""}זמן: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}\n\nקישור להצעה: ${url}`;

      // Send via Make.com webhook (same channel used for whatsapp/email notifications)
      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "quote_viewed_email",
            recipient_email: quote.notification_email,
            subject,
            body,
            quote_number: quote.quote_number,
            network_name: quote.network_name_snapshot,
          }),
        });
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
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
