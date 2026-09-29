// Runs daily. On last day of month → creates monthly km requests.
// On subsequent days → sends reminders (+1, +2, +3) then escalates to admin.
// Auth: requires CRON_SECRET header (X-Cron-Secret) OR super_admin JWT (for manual trigger).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendWhatsApp } from "../../_shared/messaging.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const PUBLIC_BASE = Deno.env.get("PUBLIC_APP_URL") ?? "https://yaroknet.co.il";

function isLastDayOfMonth(d: Date) {
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return d.getDate() === t.getDate();
}

function buildRequestMessage(driverName: string, vehicleLabel: string, plate: string, link: string) {
  return `היי ${driverName || ""} 👋\n\nהגיע הזמן לעדכן ק"מ חודשי לרכב 🚗\n\nרכב: ${vehicleLabel}\nמספר רכב: ${plate}\n\nנא לצלם את מד הק"מ הנוכחי ולהעלות בקישור הבא:\n${link}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Auth: cron secret or super_admin
    const cronHeader = req.headers.get("x-cron-secret");
    let authed = !!(CRON_SECRET && cronHeader === CRON_SECRET);
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    if (!authed) {
      const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
      if (jwt) {
        const { data: u } = await supa.auth.getUser(jwt);
        if (u?.user) {
          const { data: r } = await supa.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "super_admin").maybeSingle();
          authed = !!r;
        }
      }
    }
    if (!authed) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1"; // manual trigger from admin UI
    const now = new Date();
    const results: any = { created: 0, reminders: 0, escalations: 0, events: 0, sent: 0, failed: 0 };

    // Sends one WhatsApp and records it (fleet_n8n_events is the message log of the fleet module)
    const deliver = async (event: Record<string, any>) => {
      const sent = await sendWhatsApp(String(event.driver_phone ?? ""), String(event.message ?? ""));
      await supa.from("fleet_n8n_events").insert({
        ...event,
        status: sent.ok ? "sent" : "failed",
        sent_at: sent.ok ? new Date().toISOString() : null,
        payload: { ...(event.payload ?? {}), send_status: sent.status, ...(sent.error ? { send_error: sent.error } : {}) },
      });
      results.events++;
      if (sent.ok) results.sent++; else results.failed++;
      return sent.ok;
    };
    // user_roles and profiles have no direct relationship, so look the profiles up by user_id
    let admins: Array<{ full_name: string | null; phone: string }> | null = null;
    const adminRecipients = async () => {
      if (!admins) {
        const { data: roles } = await supa.from("user_roles").select("user_id").eq("role", "super_admin");
        const ids = (roles ?? []).map((r: any) => r.user_id);
        const { data: profiles } = ids.length
          ? await supa.from("profiles").select("full_name,phone").in("user_id", ids)
          : { data: [] };
        admins = ((profiles ?? []) as any[]).filter((p) => p.phone);
      }
      return admins!;
    };

    // ============ STEP 1: On last day → create pending reports for active vehicles with driver ============
    if (force || isLastDayOfMonth(now)) {
      const month = now.getMonth() + 1, year = now.getFullYear();

      // Active vehicles + current assignment
      const { data: assigns } = await supa
        .from("fleet_driver_assignments")
        .select("vehicle_id, driver_id, fleet_vehicles!inner(id,license_plate,make,model,status), fleet_drivers!inner(id,full_name,phone)")
        .is("end_date", null);

      for (const a of assigns ?? []) {
        const v: any = a.fleet_vehicles, d: any = a.fleet_drivers;
        if (v.status && v.status !== "active") continue;

        // Skip if report already exists for this period
        const { data: existing } = await supa
          .from("fleet_monthly_km_reports")
          .select("id, token")
          .eq("vehicle_id", v.id).eq("year", year).eq("month", month).maybeSingle();

        let report = existing;
        if (!report) {
          const { data: ins, error: e } = await supa
            .from("fleet_monthly_km_reports")
            .insert({ vehicle_id: v.id, driver_id: d.id, month, year, status: "pending" })
            .select("id, token").single();
          if (e) { console.error("insert report", e); continue; }
          report = ins;
          results.created++;
        }

        const vehicleLabel = [v.make, v.model].filter(Boolean).join(" ") || "רכב";
        const link = `${PUBLIC_BASE}/km-report/${report!.token}`;
        const message = buildRequestMessage(d.full_name, vehicleLabel, v.license_plate, link);

        // Only once per report (the job can be re-run on the same day)
        const { data: requested } = await supa.from("fleet_n8n_events")
          .select("id").eq("report_id", report!.id).eq("event_type", "km_request").eq("status", "sent").limit(1);
        if (requested?.length) continue;
        await deliver({
          event_type: "km_request",
          vehicle_id: v.id, driver_id: d.id, report_id: report!.id,
          driver_name: d.full_name, driver_phone: d.phone,
          vehicle_plate: v.license_plate, vehicle_label: vehicleLabel,
          action_url: link, message,
          payload: { month, year, link, token: report!.token },
        });
      }
    }

    // ============ STEP 2: Reminders for pending reports ============
    // +1, +2, +3 days after requested_at then escalation
    const { data: pending } = await supa
      .from("fleet_monthly_km_reports")
      .select("id, vehicle_id, driver_id, requested_at, reminder_count, last_reminder_date, month, year, token, fleet_vehicles(license_plate,make,model), fleet_drivers(full_name,phone)")
      .in("status", ["pending", "overdue"]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    for (const r of pending ?? []) {
      const req0 = new Date(r.requested_at);
      const daysSince = Math.floor((today.getTime() - new Date(req0.getFullYear(), req0.getMonth(), req0.getDate()).getTime()) / 86400000);
      if (daysSince < 1) continue;
      if (r.last_reminder_date === todayIso) continue;

      const v: any = r.fleet_vehicles, d: any = r.fleet_drivers;
      if (!v || !d) continue;
      const vehicleLabel = [v.make, v.model].filter(Boolean).join(" ") || "רכב";
      const link = `${PUBLIC_BASE}/km-report/${r.token}`;

      if (daysSince <= 3) {
        // reminder
        const message = `תזכורת 🚗 עדיין לא התקבל דיווח ק"מ לרכב ${v.license_plate}\n\nנא להשלים בקישור:\n${link}`;
        await deliver({
          event_type: "km_reminder",
          vehicle_id: r.vehicle_id, driver_id: r.driver_id, report_id: r.id,
          driver_name: d.full_name, driver_phone: d.phone,
          vehicle_plate: v.license_plate, vehicle_label: vehicleLabel,
          action_url: link, message,
          payload: { day: daysSince, reminder_number: (r.reminder_count ?? 0) + 1 },
        });
        await supa.from("fleet_monthly_km_reports").update({
          reminder_count: (r.reminder_count ?? 0) + 1,
          last_reminder_date: todayIso,
          status: "overdue",
        }).eq("id", r.id);
        results.reminders++;
      } else if (daysSince > 3) {
        // escalate to the admins (super_admins with a phone)
        const message = `⚠️ דיווח ק"מ חסר\n\nהמנהל ${d.full_name}\nרכב ${vehicleLabel}\nמספר ${v.license_plate}\n\nלא ביצע דיווח ק"מ לאחר 3 תזכורות.`;
        for (const admin of await adminRecipients()) {
          await deliver({
            event_type: "km_admin_escalation",
            vehicle_id: r.vehicle_id, driver_id: r.driver_id, report_id: r.id,
            driver_name: admin.full_name, driver_phone: admin.phone,
            vehicle_plate: v.license_plate, vehicle_label: vehicleLabel,
            action_url: link, message,
            payload: { days_since: daysSince, driver_name: d.full_name, driver_phone: d.phone },
          });
        }
        await supa.from("fleet_monthly_km_reports").update({
          status: "escalated_to_admin", last_reminder_date: todayIso,
        }).eq("id", r.id);
        results.escalations++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
