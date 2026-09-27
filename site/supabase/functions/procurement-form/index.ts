import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { action } = body ?? {};

    // Public info: list of active procurement managers + clients + catalog + shipping addresses.
    if (action === "info") {
      const [managersRes, clientsRes, catalogRes, addressesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .order("full_name"),
        supabase.from("clients").select("id, name, address, contact_name, phone").order("name"),
        supabase
          .from("internal_catalog_items")
          .select("id, name, unit_of_measure, category, permission")
          .eq("active", true)
          .order("name"),
        supabase.from("shipping_addresses").select("id, client_id, site_name, address, contact_name, contact_phone, notes, active").or("active.is.null,active.eq.true").order("site_name"),
      ]);

      return json({
        managers: managersRes.data ?? [],
        clients: clientsRes.data ?? [],
        catalog_items: (catalogRes.data ?? []).filter(
          (i: { permission: string | null }) => i.permission === "region_manager" || i.permission === null,
        ),
        addresses: addressesRes.data ?? [],
      });
    }

    // For all other actions we require a valid manager id and enforce it's enabled.
    const requestedBy = body?.requested_by_user_id;
    if (!requestedBy || typeof requestedBy !== "string") {
      return json({ error: "missing_manager" }, 400);
    }
    const { data: manager, error: mgrErr } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", requestedBy)
      .maybeSingle();
    if (mgrErr || !manager) {
      return json({ error: "manager_not_found" }, 404);
    }

    if (action === "my_orders") {
      const { data: orders } = await supabase
        .from("procurement_orders")
        .select("id, order_number, status, created_at, client_id, admin_notes, rejection_reason, clients(name)")
        .eq("created_by", manager.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      return json({ orders: orders ?? [], manager_name: manager.full_name });
    }

    if (action === "create") {
      const {
        client_id,
        shipping_address_id,
        contact_name,
        contact_phone,
        shipping_notes,
        lines,
      } = body;

      if (!Array.isArray(lines) || lines.length === 0) {
        return json({ error: "no_lines" }, 400);
      }

      const cleanLines = lines
        .filter((l: { internal_item_id?: string; quantity?: number }) => l?.internal_item_id && Number(l.quantity) > 0)
        .map((l: { internal_item_id: string; quantity: number; user_note?: string }, idx: number) => ({
          internal_item_id: String(l.internal_item_id),
          quantity: Number(l.quantity),
          user_note: l.user_note ? String(l.user_note).slice(0, 500) : null,
          sort_order: idx,
        }));

      if (cleanLines.length === 0) return json({ error: "no_valid_lines" }, 400);

      const { data: order, error: orderErr } = await supabase
        .from("procurement_orders")
        .insert({
          created_by: manager.user_id,
          client_id: client_id || null,
          shipping_address_id: shipping_address_id || null,
          contact_name: contact_name || null,
          contact_phone: contact_phone || null,
          shipping_notes: shipping_notes ? String(shipping_notes).slice(0, 1000) : null,
          status: "pending_approval",
          submitted_at: new Date().toISOString(),
        })
        .select("id, order_number")
        .single();

      if (orderErr || !order) {
        console.error("order create failed", orderErr);
        return json({ error: "create_failed", details: orderErr?.message }, 500);
      }

      const linesToInsert = cleanLines.map((l) => ({ ...l, order_id: order.id }));
      const { error: linesErr } = await supabase.from("procurement_order_lines").insert(linesToInsert);
      if (linesErr) {
        console.error("lines insert failed", linesErr);
        await supabase.from("procurement_orders").delete().eq("id", order.id);
        return json({ error: "lines_failed", details: linesErr.message }, 500);
      }

      return json({ ok: true, order_id: order.id, order_number: order.order_number });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("procurement-form error", e);
    return json({ error: "server_error", details: e instanceof Error ? e.message : String(e) }, 500);
  }
});
