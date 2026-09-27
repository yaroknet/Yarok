// Fleet Excel import edge function with optional dry_run preview.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import * as XLSX from "npm:xlsx@0.18.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Row = Record<string, any>;
const s = (v: any) => (v == null ? "" : String(v).trim());
const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: any): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) as any);
    d.setUTCDate(d.getUTCDate() + v);
    return d.toISOString().slice(0, 10);
  }
  const str = String(v).trim();
  const m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d2 = new Date(str);
  return isNaN(d2.getTime()) ? null : d2.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonH = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: jsonH });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonH });

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isMgr = (roles ?? []).some((r) => r.role === "super_admin" || r.role === "manager");
    if (!isMgr) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonH });

    const body = await req.json();
    if (!body?.file_base64) return new Response(JSON.stringify({ error: "file_base64 required" }), { status: 400, headers: jsonH });
    const dryRun: boolean = !!body.dry_run;

    const bin = Uint8Array.from(atob(body.file_base64), (c) => c.charCodeAt(0));
    const wb = XLSX.read(bin, { type: "array", cellDates: true });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const summary = {
      vehicles: { created: 0, updated: 0 },
      drivers: { created: 0, reused: 0 },
      assignments: { created: 0, unchanged: 0 },
      monthly_km: { inserted: 0, updated: 0 },
      fines: { inserted: 0, skipped: 0 },
      warnings: [] as string[],
      preview: [] as Array<{ plate: string; action: "create" | "update"; driver?: string; fields: string[] }>,
      detected_fields: [] as string[],
      missing_fields: [] as string[],
    };

    const shVeh = wb.Sheets["ניהול צי"];
    if (!shVeh) throw new Error('גיליון "ניהול צי" לא נמצא');
    const vehRows = XLSX.utils.sheet_to_json<Row>(shVeh, { header: 1, defval: null });
    const header = vehRows[1] as any[];
    const col = (name: string) => header.findIndex((h) => s(h) === name);

    const EXPECTED = ["מספר רכב","מנהל","קודן","מפתח רזרבי","סוג רכב","חברת ליסינג","תחילת ליסינג","סוף ליסינג",'ק"מ נוכחי','ק"מ טיפול 15K אחרון','תאריך טיפול 15K אחרון','טסט אחרון','חברת ביטוח','תוקף ביטוח','הקצאת ק"מ שנתית','הערות'];
    for (const name of EXPECTED) {
      if (col(name) >= 0) summary.detected_fields.push(name);
      else summary.missing_fields.push(name);
    }

    const idx = {
      plate: col("מספר רכב"), manager: col("מנהל"),
      vtype: col("סוג רכב"), lessor: col("חברת ליסינג"),
      leaseStart: col("תחילת ליסינג"), leaseEnd: col("סוף ליסינג"),
      currKm: col('ק"מ נוכחי'), lastMaintKm: col('ק"מ טיפול 15K אחרון'),
      lastMaintDate: col("תאריך טיפול 15K אחרון"), testExpiry: col("טסט אחרון"),
      insCo: col("חברת ביטוח"), insExpiry: col("תוקף ביטוח"),
      annualKm: col('הקצאת ק"מ שנתית'), notes: col("הערות"),
    };

    const driverCache = new Map<string, string>();
    const ensureDriver = async (name: string): Promise<string | null> => {
      const key = name.trim();
      if (!key) return null;
      if (driverCache.has(key)) { if (!dryRun) summary.drivers.reused++; return driverCache.get(key)!; }
      const { data: existing } = await admin.from("fleet_drivers").select("id").eq("full_name", key).maybeSingle();
      if (existing) { driverCache.set(key, existing.id); summary.drivers.reused++; return existing.id; }
      if (dryRun) { summary.drivers.created++; driverCache.set(key, "PENDING"); return "PENDING"; }
      const { data: created, error } = await admin.from("fleet_drivers").insert({ full_name: key, active: true }).select("id").single();
      if (error) { summary.warnings.push(`נהג ${key}: ${error.message}`); return null; }
      driverCache.set(key, created.id); summary.drivers.created++; return created.id;
    };

    const vehicleCache = new Map<string, string>();

    for (let i = 2; i < vehRows.length; i++) {
      const r = vehRows[i] as any[];
      if (!r) continue;
      const plate = s(r[idx.plate]);
      if (!plate || plate === "null") continue;

      const managerName = s(r[idx.manager]);
      const driverId = managerName ? await ensureDriver(managerName) : null;

      const [make, ...modelParts] = s(r[idx.vtype]).split(/\s+/);
      const vehData: any = {
        license_plate: plate, make: make || null, model: modelParts.join(" ") || null,
        leasing_company: s(r[idx.lessor]) || null,
        ownership_type: s(r[idx.lessor]).includes("פרטית") ? "private" : "leasing",
        leasing_start_date: toDate(r[idx.leaseStart]),
        current_km: num(r[idx.currKm]) ?? 0,
        last_maintenance_km: num(r[idx.lastMaintKm]),
        last_maintenance_date: toDate(r[idx.lastMaintDate]),
        test_expiry_date: toDate(r[idx.testExpiry]),
        insurance_company: s(r[idx.insCo]) || null,
        insurance_expiry_date: toDate(r[idx.insExpiry]),
        annual_km_limit: num(r[idx.annualKm]),
        notes: s(r[idx.notes]) || null,
      };
      const fieldsWithData = Object.entries(vehData).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k]) => k);

      const { data: existing } = await admin.from("fleet_vehicles").select("id, driver_id").eq("license_plate", plate).maybeSingle();

      if (dryRun) {
        summary.preview.push({
          plate,
          action: existing ? "update" : "create",
          driver: managerName || undefined,
          fields: fieldsWithData,
        });
        if (existing) summary.vehicles.updated++; else summary.vehicles.created++;
        continue;
      }

      let vehicleId: string;
      if (existing) {
        vehicleId = existing.id;
        const withDriver = driverId && driverId !== "PENDING" ? { ...vehData, driver_id: driverId } : vehData;
        await admin.from("fleet_vehicles").update(withDriver).eq("id", vehicleId);
        summary.vehicles.updated++;
        if (driverId && driverId !== "PENDING" && existing.driver_id !== driverId) {
          const today = new Date().toISOString().slice(0, 10);
          await admin.from("fleet_driver_assignments").update({ end_date: today, end_km: vehData.current_km }).eq("vehicle_id", vehicleId).is("end_date", null);
          await admin.from("fleet_driver_assignments").insert({ vehicle_id: vehicleId, driver_id: driverId, start_date: today, start_km: vehData.current_km, reason: "import from Excel", created_by: userData.user.id });
          summary.assignments.created++;
        } else summary.assignments.unchanged++;
      } else {
        const insertData = driverId && driverId !== "PENDING" ? { ...vehData, driver_id: driverId } : vehData;
        const { data: newVeh, error: vErr } = await admin.from("fleet_vehicles").insert(insertData).select("id").single();
        if (vErr) { summary.warnings.push(`רכב ${plate}: ${vErr.message}`); continue; }
        vehicleId = newVeh.id;
        summary.vehicles.created++;
        if (driverId && driverId !== "PENDING") {
          await admin.from("fleet_driver_assignments").insert({ vehicle_id: vehicleId, driver_id: driverId, start_date: vehData.leasing_start_date ?? new Date().toISOString().slice(0, 10), start_km: 0, reason: "initial import", created_by: userData.user.id });
          summary.assignments.created++;
        }
      }
      vehicleCache.set(plate, vehicleId);
    }

    if (!dryRun) {
      const shKm = wb.Sheets["קילומטרז"];
      if (shKm) {
        const kmRows = XLSX.utils.sheet_to_json<any[]>(shKm, { header: 1, defval: null });
        const kmHdr = kmRows[0] as any[];
        for (let i = 1; i < kmRows.length; i++) {
          const r = kmRows[i]; if (!r) continue;
          const plate = s(r[0]); const vid = vehicleCache.get(plate);
          if (!vid) continue;
          for (let c = 2; c < kmHdr.length; c++) {
            const label = s(kmHdr[c]);
            const m = label.match(/^(\d{1,2})[./-](\d{2,4})$/);
            if (!m) continue;
            const month = parseInt(m[1], 10);
            const year = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
            const kmVal = num(r[c]); if (kmVal == null) continue;
            const { error, count } = await admin.from("fleet_km_monthly").upsert({ vehicle_id: vid, year, month, km: kmVal, source: "excel-import" }, { onConflict: "vehicle_id,year,month", count: "exact" });
            if (error) summary.warnings.push(`ק"מ ${plate} ${label}: ${error.message}`);
            else summary.monthly_km.inserted += count ?? 1;
          }
        }
      }

      const shF = wb.Sheets["קנסות"];
      if (shF) {
        const fRows = XLSX.utils.sheet_to_json<any[]>(shF, { header: 1, defval: null });
        const fHdr = fRows[0] as any[];
        const fCol = (name: string) => fHdr.findIndex((h) => s(h) === name);
        const fIdx = { plate: fCol("מס' רכב"), ref: fCol("מס' דוח"), authority: fCol("רשות/גורם"), reason: fCol("מהות עבירה"), amount: fCol("סכום לתשלום"), date: fCol("תאריך עבירה"), status: fCol("סטטוס תשלום"), paid: fCol("תאריך תשלום"), due: fCol("מועד אחרון לתשלום"), notes: fCol("הערות") };
        for (let i = 1; i < fRows.length; i++) {
          const r = fRows[i]; if (!r) continue;
          const plate = s(r[fIdx.plate]); const vid = vehicleCache.get(plate);
          const amount = num(r[fIdx.amount]); const date = toDate(r[fIdx.date]);
          if (!vid || amount == null || !date) { summary.fines.skipped++; continue; }
          const { error } = await admin.from("fleet_fines").insert({ vehicle_id: vid, fine_date: date, amount, reference_number: s(r[fIdx.ref]) || null, reason: s(r[fIdx.reason]) || null, location: s(r[fIdx.authority]) || null, due_date: toDate(r[fIdx.due]), paid_at: toDate(r[fIdx.paid]), status: s(r[fIdx.status]) === "שולם" ? "paid" : "open", notes: s(r[fIdx.notes]) || null });
          if (error) { summary.warnings.push(`קנס ${plate}: ${error.message}`); summary.fines.skipped++; } else summary.fines.inserted++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, summary }), { headers: jsonH });
  } catch (e) {
    console.error("[fleet-import]", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: jsonH });
  }
});
