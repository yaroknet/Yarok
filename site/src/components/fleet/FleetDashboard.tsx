import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Car, Users, AlertTriangle, Wrench, ShieldCheck, Gauge, FileCheck, Bell, Zap } from "lucide-react";
import { daysUntil, fmtDate, kmUtilization } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";

export function FleetDashboard() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [kmThisMonth, setKmThisMonth] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const [v, d, a, km] = await Promise.all([
        supabase.from("fleet_vehicles").select("*"),
        supabase.from("fleet_drivers").select("id,full_name"),
        supabase.from("fleet_alerts").select("*, fleet_vehicles(license_plate), fleet_drivers(full_name)").eq("status", "pending").order("severity", { ascending: false }).order("due_date", { ascending: true }).limit(50),
        supabase.from("fleet_monthly_km_reports").select("id", { count: "exact", head: true }).eq("year", now.getFullYear()).eq("month", now.getMonth() + 1).eq("status", "submitted"),
      ]);
      setVehicles(v.data ?? []);
      const map: Record<string, any> = {}; (d.data ?? []).forEach((x: any) => (map[x.id] = x));
      setDrivers(map);
      setAlerts(a.data ?? []);
      setKmThisMonth((km as any).count ?? 0);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  const active = vehicles.filter(v => v.status === "active").length;
  const testSoon = vehicles.filter(v => { const d = daysUntil(v.test_expiry_date); return d !== null && d <= 30; }).length;
  const testExpired = vehicles.filter(v => { const d = daysUntil(v.test_expiry_date); return d !== null && d < 0; }).length;
  const insSoon = vehicles.filter(v => { const d = daysUntil(v.insurance_expiry_date); return d !== null && d <= 30; }).length;
  const maintDue = vehicles.filter(v => v.last_maintenance_km && (v.current_km ?? 0) - v.last_maintenance_km >= (v.maintenance_interval_km ?? 15000) - 1000).length;
  const kmOver = vehicles.filter(v => kmUtilization(v).status !== "ok").length;

  const dangerAlerts = alerts.filter(a => a.severity === "danger" || (a.due_date && (daysUntil(a.due_date) ?? 999) < 0));
  const warnAlerts = alerts.filter(a => !dangerAlerts.includes(a) && (a.severity === "warn" || a.severity === "warning"));

  return (
    <div className="space-y-6">
      {/* Priority section */}
      {dangerAlerts.length > 0 && (
        <Card className="p-5 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-destructive" />
            <h3 className="font-bold text-lg text-destructive">דורש טיפול עכשיו — {dangerAlerts.length}</h3>
          </div>
          <div className="space-y-2">
            {dangerAlerts.slice(0, 6).map(a => <AlertRow key={a.id} a={a} />)}
          </div>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat icon={Car} label="סה״כ רכבים" value={vehicles.length} tone="neutral" />
        <BigStat icon={ShieldCheck} label="פעילים" value={active} tone={active === vehicles.length ? "ok" : "neutral"} />
        <BigStat icon={Bell} label="התראות פתוחות" value={alerts.length} tone={dangerAlerts.length ? "danger" : alerts.length ? "warn" : "ok"} />
        <BigStat icon={Wrench} label="טיפולים מתקרבים" value={maintDue} tone={maintDue ? "warn" : "ok"} />
        <BigStat icon={FileCheck} label='טסטים ≤30 יום' value={testSoon} sub={testExpired ? `${testExpired} פגי תוקף` : undefined} tone={testExpired ? "danger" : testSoon ? "warn" : "ok"} />
        <BigStat icon={ShieldCheck} label='ביטוחים ≤30 יום' value={insSoon} tone={insSoon ? "warn" : "ok"} />
        <BigStat icon={Gauge} label='חריגות ק"מ' value={kmOver} tone={kmOver ? "danger" : "ok"} />
        <BigStat icon={Users} label='דיווח ק"מ החודש' value={`${kmThisMonth}/${vehicles.length}`} tone={kmThisMonth >= vehicles.length ? "ok" : "warn"} />
      </div>

      {/* All alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3"><Bell className="h-4 w-4" /><h3 className="font-semibold">כל ההתראות הפתוחות</h3></div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין התראות פתוחות. יופקו אוטומטית: טסט/ביטוח ≤30 יום, טיפול ≤1000 ק״מ, חריגת ק״מ ≥15%.</p>
        ) : (
          <div className="space-y-2">
            {(warnAlerts.length ? warnAlerts : alerts).slice(0, 20).map(a => <AlertRow key={a.id} a={a} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function AlertRow({ a }: { a: any }) {
  const overdue = a.due_date && (daysUntil(a.due_date) ?? 999) < 0;
  const dangerVariant = a.severity === "danger" || overdue;
  return (
    <div className="flex items-center justify-between gap-3 border-b last:border-0 pb-2 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{a.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {a.fleet_vehicles?.license_plate && <>רכב <b className="font-mono">{a.fleet_vehicles.license_plate}</b> · </>}
          {a.fleet_drivers?.full_name && <>נהג {a.fleet_drivers.full_name} · </>}
          {a.body}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {a.due_date && <span className={`text-xs ${overdue ? "text-destructive font-bold" : "text-muted-foreground"}`}>{fmtDate(a.due_date)}</span>}
        <Badge variant={dangerVariant ? "destructive" : "secondary"}>{a.severity}</Badge>
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, sub, tone = "neutral" }: { icon: any; label: string; value: any; sub?: string; tone?: "ok" | "warn" | "danger" | "neutral" }) {
  const cls = tone === "danger"
    ? "bg-destructive/10 border-destructive/40 text-destructive"
    : tone === "warn"
    ? "bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400"
    : tone === "ok"
    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
    : "bg-card border-border";
  return (
    <Card className={`p-5 border-2 ${cls}`}>
      <div className="flex items-center gap-2 mb-2 text-current opacity-90"><Icon className="h-5 w-5" /><span className="text-xs font-medium">{label}</span></div>
      <div className="text-3xl font-extrabold tracking-tight text-current">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-80">{sub}</div>}
    </Card>
  );
}
