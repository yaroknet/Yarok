// Public endpoint for KM submission via token link. No JWT required.
// GET  ?token=xxx        → returns report + vehicle + driver context
// POST { token, current_km, odometer_image?, note?, submitted_by_name? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data, error } = await supa
        .from("fleet_monthly_km_reports")
        .select("id,month,year,status,current_km,submitted_at,requested_at,fleet_vehicles(id,license_plate,make,model,current_km),fleet_drivers(id,full_name,phone)")
        .eq("token", token).maybeSingle();
      if (error) throw error;
      if (!data) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { token, current_km, odometer_image, note, submitted_by_name } = body ?? {};
      if (!token || typeof current_km !== "number" || current_km < 0 || current_km > 9999999) {
        return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: rep, error: e1 } = await supa
        .from("fleet_monthly_km_reports")
        .select("id, vehicle_id, driver_id, status, month, year")
        .eq("token", token).maybeSingle();
      if (e1) throw e1;
      if (!rep) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (rep.status === "submitted") {
        return new Response(JSON.stringify({ error: "already submitted" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: e2 } = await supa.from("fleet_monthly_km_reports").update({
        current_km, odometer_image: odometer_image ?? null, note: note ?? null,
        submitted_by_name: submitted_by_name ?? null,
        submitted_at: new Date().toISOString(), status: "submitted",
      }).eq("id", rep.id);
      if (e2) throw e2;

      // Update vehicle current_km (never decrease)
      await supa.from("fleet_vehicles").update({ current_km })
        .eq("id", rep.vehicle_id).lt("current_km", current_km);

      // Insert into monthly history (upsert on unique period)
      await supa.from("fleet_km_monthly").upsert({
        vehicle_id: rep.vehicle_id, year: rep.year, month: rep.month,
        end_km: current_km,
      }, { onConflict: "vehicle_id,year,month" });

      // Optional km_readings row
      await supa.from("fleet_km_readings").insert({
        vehicle_id: rep.vehicle_id, reading_km: current_km,
        reading_date: new Date().toISOString().slice(0, 10),
        source: "monthly_report", photo_url: odometer_image ?? null, note: note ?? null,
      }).select().maybeSingle().then(() => {}).catch(() => {});

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
