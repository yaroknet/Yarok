// Public endpoint (no JWT) for external reports via generic link:
//  GET  ?action=drivers                       → list of {id, full_name}
//  GET  ?action=driver_vehicle&driver_id=xxx  → { vehicles: [...] }  active only
//  POST { action: "incident", driver_id, vehicle_id, incident_date, location?, description?, attachments?, damage_markers?, third_party?, submitted_by_name? }
//  POST { action: "km", driver_id, vehicle_id, current_km, odometer_image?, note?, submitted_by_name? }
// Never returns unrelated fleet data. Insert-only surface.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "drivers") {
        const { data, error } = await supa
          .from("fleet_drivers")
          .select("id, full_name")
          .eq("active", true)
          .order("full_name");
        if (error) throw error;
        return json({ drivers: data ?? [] });
      }

      if (action === "driver_vehicle") {
        const driver_id = url.searchParams.get("driver_id");
        if (!driver_id) return json({ error: "missing driver_id" }, 400);
        const today = new Date().toISOString().slice(0, 10);
        const { data: asg, error: e1 } = await supa
          .from("fleet_driver_assignments")
          .select("vehicle_id, start_date, end_date")
          .eq("driver_id", driver_id);
        if (e1) throw e1;
        const active = (asg ?? []).filter((r: any) =>
          (!r.start_date || r.start_date <= today) &&
          (!r.end_date || r.end_date >= today)
        );
        const ids = Array.from(new Set(active.map((r: any) => r.vehicle_id)));
        if (!ids.length) return json({ vehicles: [] });
        const { data: veh, error: e2 } = await supa
          .from("fleet_vehicles")
          .select("id, license_plate, make, model, vehicle_type, current_km")
          .in("id", ids);
        if (e2) throw e2;
        return json({ vehicles: veh ?? [] });
      }

      return json({ error: "unknown action" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body ?? {};

      // Validate driver + active vehicle association server-side
      const requireDriverVehicle = async (driver_id: string, vehicle_id: string) => {
        if (!driver_id || !vehicle_id) throw new Error("חסר נהג/רכב");
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supa
          .from("fleet_driver_assignments")
          .select("start_date, end_date")
          .eq("driver_id", driver_id)
          .eq("vehicle_id", vehicle_id);
        if (error) throw error;
        const ok = (data ?? []).some((r: any) =>
          (!r.start_date || r.start_date <= today) &&
          (!r.end_date || r.end_date >= today)
        );
        if (!ok) throw new Error("הרכב לא משויך לנהג זה");
      };

      if (action === "incident") {
        const { driver_id, vehicle_id, incident_date, location, description, attachments, damage_markers, third_party, submitted_by_name } = body;
        await requireDriverVehicle(driver_id, vehicle_id);
        if (!incident_date) return json({ error: "חסר תאריך" }, 400);
        const att = Array.isArray(attachments) ? attachments.slice(0, 30) : [];
        const { error } = await supa.from("fleet_incidents").insert({
          driver_id, vehicle_id, incident_date,
          location: location ?? null,
          description: description ?? null,
          photos: att,
          damage_markers: Array.isArray(damage_markers) ? damage_markers : [],
          third_party: third_party ?? null,
          status: "reported",
          external_reporter_name: submitted_by_name ?? null,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      if (action === "km") {
        const { driver_id, vehicle_id, current_km, odometer_image, note, submitted_by_name } = body;
        await requireDriverVehicle(driver_id, vehicle_id);
        if (typeof current_km !== "number" || current_km < 0 || current_km > 9999999) {
          return json({ error: "ק\"מ לא תקין" }, 400);
        }
        if (!odometer_image) return json({ error: "חובה לצלם את מד הק\"מ" }, 400);

        // Enforce not going backwards vs last known km
        const { data: v } = await supa.from("fleet_vehicles").select("current_km").eq("id", vehicle_id).maybeSingle();
        const lastKm = Number(v?.current_km ?? 0);
        if (lastKm && current_km < lastKm) {
          return json({ error: "הק״מ שהוזן נמוך מהק״מ האחרון במערכת" }, 400);
        }

        const today = new Date();
        const y = today.getFullYear(), m = today.getMonth() + 1;

        // Insert reading (trigger updates fleet_vehicles.current_km with GREATEST)
        const { error: e1 } = await supa.from("fleet_km_readings").insert({
          vehicle_id, reading_km: current_km,
          reading_date: today.toISOString().slice(0, 10),
          source: "public_report", photo_url: odometer_image,
          note: note ?? null,
        });
        if (e1) throw e1;

        // Upsert monthly history
        await supa.from("fleet_km_monthly").upsert({
          vehicle_id, year: y, month: m, end_km: current_km,
        }, { onConflict: "vehicle_id,year,month" });

        // Also mark this month's requested report as submitted, if any pending
        await supa.from("fleet_monthly_km_reports").update({
          current_km, odometer_image, note: note ?? null,
          submitted_by_name: submitted_by_name ?? null,
          submitted_at: new Date().toISOString(), status: "submitted",
        }).eq("vehicle_id", vehicle_id).eq("year", y).eq("month", m).neq("status", "submitted");

        return json({ ok: true });
      }

      return json({ error: "unknown action" }, 400);
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e: any) {
    console.error(e);
    return json({ error: e.message ?? "internal error" }, 500);
  }
});
