// Sends quotation data to Make.com webhook for email automation.
// Triggered when admin clicks "send" on a quote (quotation_sent).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/9y338278wlfgq47s1azirsyigpb9ke34";

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
    const { quoteId, recipientEmail } = await req.json();
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
      .select("description,frequency,price,quantity,sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order");

    // Build the public quote URL (works on lovable.app or custom domain)
    const origin = req.headers.get("origin") || `${SUPABASE_URL.replace(".supabase.co", ".lovable.app").replace("https://", "https://")}`;
    const quoteUrl = `${origin}/quote/${quote.unique_token}`;

    const isNewClient = !!quote.requires_client_details;
    const target = (recipientEmail || quote.contact_email || "").trim();

    if (!target) {
      return new Response(JSON.stringify({ error: "No recipient email available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const materialsText = (quote.materials || []).map((m: string) =>
      m === "other" ? `אחר: ${quote.materials_other_text || ""}` : (MATERIAL_LABELS[m] || m)
    );

    const payload = {
      trigger_type: "quotation_sent",
      is_new_client: isNewClient,
      recipient_email: target,
      client_name: quote.contact_name || quote.network_name_snapshot,
      pdf_download_url: quoteUrl,
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        network_name: quote.network_name_snapshot,
        branch_name: quote.branch_name,
        contact_name: quote.contact_name,
        contact_phone: quote.contact_phone,
        contact_email: quote.contact_email,
        payment_terms: quote.payment_terms,
        total_amount: Number(quote.total_amount || 0),
        notes: quote.notes,
        materials: materialsText,
        items: (items || []).map((it) => ({
          description: it.description,
          frequency: it.frequency,
          price: Number(it.price),
          quantity: Number((it as { quantity?: number }).quantity ?? 1),
        })),
      },
      // form_data placeholder for new-client routing in Make
      form_data: isNewClient
        ? {
            vat_number: quote.filled_vat_number || null,
            billing_address: quote.filled_billing_address || null,
            contact_person: quote.filled_contact_person || null,
            office_phone: quote.filled_office_phone || null,
            email: quote.filled_email || null,
          }
        : null,
    };

    const payloadJson = JSON.stringify(payload);
    console.log("=== MAKE WEBHOOK PAYLOAD START ===");
    console.log("URL:", MAKE_WEBHOOK_URL);
    console.log("Recipient:", target);
    console.log("Quote ID:", quote.id, "Number:", quote.quote_number);
    console.log("Is new client:", isNewClient);
    console.log("Items count:", (items || []).length);
    console.log("Full payload:", payloadJson);
    console.log("Payload size (bytes):", payloadJson.length);
    console.log("=== MAKE WEBHOOK PAYLOAD END ===");

    const makeRes = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadJson,
    });

    const makeBody = await makeRes.text();
    console.log("Make webhook response status:", makeRes.status);
    console.log("Make webhook response body:", makeBody);

    if (!makeRes.ok) {
      return new Response(JSON.stringify({ error: "Make webhook failed", status: makeRes.status, body: makeBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark quote as sent
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("status", "draft"); // only flip from draft

    return new Response(JSON.stringify({ ok: true, recipient: target, quote_url: quoteUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-quote-make error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
