// Fleet Alerts Cron
// יוצר התראות רק לפי החוקיות שהוגדרה על ידי המשתמש:
//   1. טסט: 30/14 יום לפני סיום  (אדמין + נהג)
//   2. ביטוח: 30/7 יום לפני סיום  (אדמין בלבד)
//   3. טיפול: 1000/500 ק"מ לפני היעד או כאשר עברה שנה מהטיפול (אדמין + נהג)
//   4. ניצול ק"מ שנתי: מדרגות 70/80/90/100% (התראה חד-פעמית לכל מדרגה, רק כשמעל קצב הזמן)
// דיווח ק"מ חודשי מטופל ב-fleet-km-cron.
// כל התראה נשמרת ב-fleet_alerts (dedup_key ייחודי), נשלחת ב-WhatsApp לנמענים ונרשמת ב-fleet_n8n_events (sent/failed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s?: string | null) => (s ? new Date(s + "T00:00:00") : null);

type Vehicle = {
  id: string; license_plate: string; make: string | null; model: string | null;
  status: string; test_expiry_date: string | null; insurance_expiry_date: string | null;
  insurance_company: string | null; last_maintenance_date: string | null;
  last_maintenance_km: number | null; maintenance_interval_km: number | null;
  current_km: number | null; initial_km: number | null;
  leasing_start_date: string | null; leasing_end_date: string | null;
  leasing_months: number | null; annual_km_limit: number | null;
};
type Driver = { id: string; full_name: string; phone: string | null; user_id: string | null };
type Assign = { vehicle_id: string; driver_id: string; fleet_drivers: Driver };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: cron secret OR super_admin JWT (manual trigger)
  const cronHeader = req.headers.get("x-cron-secret");
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  let authed = !!(CRON_SECRET && cronHeader === CRON_SECRET);
  if (!authed) {
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (jwt) {
      const { data: u } = await supa.auth.getUser(jwt);
      if (u?.user) {
        const { data: r } = await supa.from("user_roles").select("role")
          .eq("user_id", u.user.id).eq("role", "super_admin").maybeSingle();
        authed = !!r;
      }
    }
  }
  if (!authed) return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = iso(today);
  const results = { alerts: 0, events: 0, sent: 0, failed: 0, skippedDup: 0 };

  // Sends one WhatsApp and records it (fleet_n8n_events is the message log of the fleet module)
  async function deliver(event: Record<string, unknown> & { driver_phone: string; message: string; payload: Record<string, unknown> }) {
    const sent = await sendWhatsApp(event.driver_phone, event.message);
    await supa.from("fleet_n8n_events").insert({
      ...event,
      status: sent.ok ? "sent" : "failed",
      sent_at: sent.ok ? new Date().toISOString() : null,
      payload: { ...event.payload, send_status: sent.status, ...(sent.error ? { send_error: sent.error } : {}) },
    });
    results.events++;
    if (sent.ok) results.sent++; else results.failed++;
    return sent.ok;
  }

  // user_roles and profiles have no direct relationship, so look the profiles up by user_id
  let admins: Array<{ full_name: string | null; phone: string }> | null = null;
  async function adminRecipients() {
    if (!admins) {
      const { data: roles } = await supa.from("user_roles").select("user_id").eq("role", "super_admin");
      const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
      const { data: profiles } = ids.length
        ? await supa.from("profiles").select("full_name,phone").in("user_id", ids)
        : { data: [] };
      admins = ((profiles ?? []) as Array<{ full_name: string | null; phone: string | null }>)
        .filter((p): p is { full_name: string | null; phone: string } => !!p.phone);
    }
    return admins;
  }

  // Load active vehicles + current driver assignments
  const { data: vehicles } = await supa
    .from("fleet_vehicles")
    .select("id,license_plate,make,model,status,test_expiry_date,insurance_expiry_date,insurance_company,last_maintenance_date,last_maintenance_km,maintenance_interval_km,current_km,initial_km,leasing_start_date,leasing_end_date,leasing_months,annual_km_limit")
    .eq("status", "active");

  const { data: assigns } = await supa
    .from("fleet_driver_assignments")
    .select("vehicle_id,driver_id,fleet_drivers(id,full_name,phone,user_id)")
    .is("end_date", null);
  const driverByVehicle = new Map<string, Driver>();
  for (const a of (assigns ?? []) as unknown as Assign[]) {
    if (a.fleet_drivers) driverByVehicle.set(a.vehicle_id, a.fleet_drivers);
  }

  // Helper: create alert (dedup) + WhatsApp to admins / driver
  async function emit(opts: {
    alert_type: string; vehicle: Vehicle; driver: Driver | null;
    dedup_key: string; severity: "info" | "warn" | "danger";
    title: string; body: string; due_date?: string | null;
    payload?: Record<string, unknown>;
    notifyDriver: boolean;
    alert_level?: number | null;
  }) {

    // Skip if an OPEN alert (pending/sent) with same dedup already exists
    const { data: existing } = await supa.from("fleet_alerts")
      .select("id,status").eq("dedup_key", opts.dedup_key).maybeSingle();
    if (existing && (existing.status === "pending" || existing.status === "sent")) {
      results.skippedDup++; return;
    }
    if (existing) return; // resolved/dismissed – do not resurrect

    const { data: alert, error: aErr } = await supa.from("fleet_alerts").insert({
      alert_type: opts.alert_type, vehicle_id: opts.vehicle.id,
      driver_id: opts.driver?.id ?? null, dedup_key: opts.dedup_key,
      severity: opts.severity, title: opts.title, body: opts.body,
      due_date: opts.due_date ?? null, status: "pending",
      payload: opts.payload ?? {},
      alert_level: opts.alert_level ?? null,
    }).select("id").single();

    if (aErr) { console.error("alert insert", aErr, opts.dedup_key); return; }
    results.alerts++;

    const vehicleLabel = [opts.vehicle.make, opts.vehicle.model].filter(Boolean).join(" ") || "רכב";
    const baseEvent = {
      event_type: opts.alert_type, vehicle_id: opts.vehicle.id,
      vehicle_plate: opts.vehicle.license_plate, vehicle_label: vehicleLabel,
      payload: opts.payload ?? {},
    };
    // Admin recipients (all super_admins with a phone)
    let anySent = false;
    for (const a of await adminRecipients()) {
      anySent = (await deliver({
        ...baseEvent, driver_name: a.full_name, driver_phone: a.phone,
        message: `[אדמין] ${opts.title}\n${opts.body}`,
      })) || anySent;
    }
    if (opts.notifyDriver && opts.driver?.phone) {
      anySent = (await deliver({
        ...baseEvent, driver_id: opts.driver.id,
        driver_name: opts.driver.full_name, driver_phone: opts.driver.phone,
        message: `${opts.title}\n${opts.body}`,
      })) || anySent;
    }
    if (anySent && alert?.id) {
      await supa.from("fleet_alerts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", alert.id);
    }
  }

  for (const v of (vehicles ?? []) as Vehicle[]) {
    const driver = driverByVehicle.get(v.id) ?? null;
    const vehicleLabel = [v.make, v.model].filter(Boolean).join(" ") || "רכב";
    const driverName = driver?.full_name ?? "ללא נהג";

    // === 1. TEST expiry: 30 / 14 days ===
    const testDate = parse(v.test_expiry_date);
    if (testDate) {
      const daysLeft = daysBetween(testDate, today);
      for (const window of [30, 14]) {
        if (daysLeft === window) {
          const sev = window <= 14 ? "danger" : "warn";
          await emit({
            alert_type: "test_expiry", vehicle: v, driver, notifyDriver: true,
            dedup_key: `test:${v.id}:${v.test_expiry_date}:${window}`,
            severity: sev,
            title: `טסט מסתיים בעוד ${window} יום`,
            body: `רכב ${v.license_plate} (${vehicleLabel}) · נהג ${driverName} · תוקף טסט: ${v.test_expiry_date}`,
            due_date: v.test_expiry_date,
            payload: { days_left: daysLeft, window },
          });
        }
      }
    }

    // === 2. INSURANCE expiry: 30 / 7 days (admin only) ===
    const insDate = parse(v.insurance_expiry_date);
    if (insDate) {
      const daysLeft = daysBetween(insDate, today);
      for (const window of [30, 7]) {
        if (daysLeft === window) {
          const sev = window <= 7 ? "danger" : "warn";
          await emit({
            alert_type: "insurance_expiry", vehicle: v, driver, notifyDriver: false,
            dedup_key: `insurance:${v.id}:${v.insurance_expiry_date}:${window}`,
            severity: sev,
            title: `ביטוח מסתיים בעוד ${window} יום`,
            body: `רכב ${v.license_plate} (${vehicleLabel}) · חברה: ${v.insurance_company ?? "-"} · תוקף: ${v.insurance_expiry_date}`,
            due_date: v.insurance_expiry_date,
            payload: { days_left: daysLeft, window, insurance_company: v.insurance_company },
          });
        }
      }
    }

    // === 3. MAINTENANCE: km-based (1000/500) or time-based (12 months) ===
    const interval = v.maintenance_interval_km ?? 15000;
    const lastKm = v.last_maintenance_km ?? v.initial_km ?? 0;
    const nextKm = lastKm + interval;
    const currentKm = v.current_km ?? 0;
    const kmRemaining = nextKm - currentKm;
    if (currentKm > 0) {
      for (const window of [1000, 500]) {
        if (kmRemaining <= window && kmRemaining > window - 100) {
          const sev = window <= 500 ? "danger" : "warn";
          await emit({
            alert_type: "maintenance_due", vehicle: v, driver, notifyDriver: true,
            dedup_key: `maint_km:${v.id}:${nextKm}:${window}`,
            severity: sev,
            title: `טיפול תקופתי בעוד ${window} ק"מ`,
            body: `רכב ${v.license_plate} · נהג ${driverName} · ק"מ נוכחי ${currentKm} · טיפול אחרון ${lastKm} · יעד ${nextKm}`,
            payload: { km_remaining: kmRemaining, current_km: currentKm, next_km: nextKm, last_km: lastKm },
          });
        }
      }
    }
    // Time-based: passed 12 months since last maintenance
    const lastDate = parse(v.last_maintenance_date);
    if (lastDate) {
      const monthsSince = (today.getTime() - lastDate.getTime()) / (86400000 * 30.44);
      if (monthsSince >= 12) {
        await emit({
          alert_type: "maintenance_due", vehicle: v, driver, notifyDriver: true,
          dedup_key: `maint_time:${v.id}:${v.last_maintenance_date}`,
          severity: "warn",
          title: `נדרש טיפול תקופתי (עברה שנה)`,
          body: `רכב ${v.license_plate} · נהג ${driverName} · טיפול אחרון: ${v.last_maintenance_date}`,
          payload: { last_maintenance_date: v.last_maintenance_date, months_since: Math.round(monthsSince) },
        });
      }
    }

    // === 5. ANNUAL KM UTILIZATION: 70/80/90/100 thresholds within current lease year ===
    // Only alert when driving faster than pace, one alert per threshold crossed.
    if (v.leasing_start_date && v.annual_km_limit && v.annual_km_limit > 0) {
      const leaseStart = parse(v.leasing_start_date)!;
      const daysSinceStart = daysBetween(today, leaseStart);
      if (daysSinceStart > 0) {
        const yearIndex = Math.floor(daysSinceStart / 365);
        const yearStart = new Date(leaseStart);
        yearStart.setFullYear(yearStart.getFullYear() + yearIndex);
        const daysIntoYear = Math.max(1, daysBetween(today, yearStart));
        const totalUsed = Math.max(0, currentKm - (v.initial_km ?? 0));
        const currentYearKm = Math.max(0, totalUsed - yearIndex * v.annual_km_limit);
        const actualPct = (currentYearKm / v.annual_km_limit) * 100;
        const expectedKm = v.annual_km_limit * (daysIntoYear / 365);
        const pacePct = expectedKm > 0 ? (currentYearKm / expectedKm) * 100 : 0;
        const leaseYearKey = iso(yearStart);

        // Only trigger thresholds when ahead of pace (driving too fast for the plan)
        let currentLevel = 0;
        if (pacePct > 100) {
          for (const t of [70, 80, 90, 100]) if (actualPct >= t) currentLevel = t;
        }

        // Find highest previously-emitted threshold for THIS lease year
        const { data: prev } = await supa
          .from("fleet_alerts")
          .select("alert_level")
          .eq("alert_type", "km_overuse")
          .eq("vehicle_id", v.id)
          .like("dedup_key", `km_overuse:${v.id}:${leaseYearKey}:%`)
          .order("alert_level", { ascending: false })
          .limit(1)
          .maybeSingle();
        const prevLevel = prev?.alert_level ?? 0;

        if (currentLevel === 0) {
          // Back to normal — resolve any open km_overuse alerts for this lease year
          await supa
            .from("fleet_alerts")
            .update({ status: "resolved", resolved_at: new Date().toISOString() })
            .eq("alert_type", "km_overuse")
            .eq("vehicle_id", v.id)
            .like("dedup_key", `km_overuse:${v.id}:${leaseYearKey}:%`)
            .in("status", ["pending", "sent"]);
        } else if (currentLevel > prevLevel) {
          const actualR = Math.round(actualPct);
          const yearKmR = Math.round(currentYearKm);
          const expectedR = Math.round((daysIntoYear / 365) * 100);
          const titleByLevel: Record<number, string> = {
            70: `שים לב 🚗 – ${actualR}% ניצול ק״מ שנתי`,
            80: `שים לב – ${actualR}% ניצול ק״מ שנתי`,
            90: `אזהרה – ${actualR}% ניצול ק״מ שנתי`,
            100: `חריגת מכסת ק״מ שנתית – ${actualR}%`,
          };
          const body =
            currentLevel === 70
              ? `שים לב 🚗\nהרכב מתקרב לניצול מכסת הק״מ השנתית.\nבוצע שימוש של ${yearKmR} מתוך ${v.annual_km_limit} ק״מ (${actualR}%).\nמומלץ לבדוק קצב נסיעה.`
              : `רכב ${v.license_plate} · נהג ${driverName}\nניצול בפועל: ${actualR}% (${yearKmR}/${v.annual_km_limit} ק״מ)\nצפי לפי זמן: ${expectedR}% · קצב: ${Math.round(pacePct)}% מהצפוי.`;
          await emit({
            alert_type: "km_overuse", vehicle: v, driver, notifyDriver: true,
            dedup_key: `km_overuse:${v.id}:${leaseYearKey}:${currentLevel}`,
            severity: currentLevel >= 100 ? "danger" : currentLevel >= 90 ? "warn" : "info",
            title: titleByLevel[currentLevel],
            body,
            alert_level: currentLevel,
            payload: {
              alert_level: currentLevel,
              actual_pct: actualR,
              pace_pct: Math.round(pacePct),
              expected_pct: expectedR,
              current_year_km: yearKmR,
              annual_km_limit: v.annual_km_limit,
              lease_year_start: leaseYearKey,
              year_index: yearIndex,
            },
          });
        }
      }
    }

  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
