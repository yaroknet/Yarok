import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Copy, RefreshCw } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין", submitted: "דווח", overdue: "באיחור", escalated_to_admin: "הוסלם",
};
const STATUS_VARIANT: Record<string, any> = {
  pending: "secondary", submitted: "outline", overdue: "destructive", escalated_to_admin: "destructive",
};

export function KmMonthlyManagement() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [period, setPeriod] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fleet_monthly_km_reports")
      .select("*, fleet_vehicles(license_plate,make,model), fleet_drivers(full_name,phone)")
      .eq("year", period.year).eq("month", period.month)
      .order("status");
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [period.year, period.month]);

  const triggerCron = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("fleet-km-cron?force=1");
      if (error) throw error;
      toast.success(`הופעל: ${data?.created ?? 0} חדשים, ${data?.reminders ?? 0} תזכורות, ${data?.escalations ?? 0} הסלמות`);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/km-report/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("הקישור הועתק"));
  };

  const total = rows.length;
  const submitted = rows.filter(r => r.status === "submitted").length;
  const pending = rows.filter(r => r.status === "pending").length;
  const overdue = rows.filter(r => r.status === "overdue" || r.status === "escalated_to_admin").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">דיווחי ק"מ חודשיים</h2>
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={period.month} onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={period.year} onChange={e => setPeriod(p => ({ ...p, year: Number(e.target.value) }))}>
            {[period.year - 1, period.year, period.year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4 ml-1" />רענון</Button>
        </div>
        <div className="mr-auto">
          <Button onClick={triggerCron} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Play className="h-4 w-4 ml-1" />}
            הפעל מחזור דיווחים ידני
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="סה״כ בקשות" value={total} />
        <Kpi label="דווחו" value={submitted} tone="ok" />
        <Kpi label="ממתינים" value={pending} tone="warn" />
        <Kpi label="באיחור / הוסלמו" value={overdue} tone="danger" />
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>רכב</TableHead>
                <TableHead>נהג</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>ק"מ שדווח</TableHead>
                <TableHead>תזכורות</TableHead>
                <TableHead>נשלח בתאריך</TableHead>
                <TableHead>דווח בתאריך</TableHead>
                <TableHead className="text-left">קישור</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const v = r.fleet_vehicles, d = r.fleet_drivers;
                return (
                  <TableRow key={r.id}>
                    <TableCell><span className="font-mono">{v?.license_plate}</span> · {[v?.make, v?.model].filter(Boolean).join(" ")}</TableCell>
                    <TableCell>{d?.full_name ?? "-"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                    <TableCell className="font-mono">{r.current_km?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell>{r.reminder_count ?? 0}</TableCell>
                    <TableCell className="text-xs">{new Date(r.requested_at).toLocaleDateString("he-IL")}</TableCell>
                    <TableCell className="text-xs">{r.submitted_at ? new Date(r.submitted_at).toLocaleString("he-IL") : "-"}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => copyLink(r.token)}><Copy className="h-3 w-3 ml-1" />העתק</Button></TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">אין דיווחים לתקופה זו.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>

      <N8nEventsPanel />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "text-green-600" : tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function N8nEventsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("fleet_n8n_events").select("*").order("created_at", { ascending: false }).limit(20);
    setEvents(data ?? []);
  };
  useEffect(() => { load(); }, []);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">אירועי N8N אחרונים (Webhook Queue)</h3>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="text-xs text-muted-foreground mb-3">
        אירועים אלו מוכנים למשיכה על ידי N8N. כל אירוע כולל טקסט מוכן, טלפון נהג וקישור פעולה.
      </div>
      <div className="space-y-2 max-h-64 overflow-auto">
        {events.map(e => (
          <div key={e.id} className="border rounded p-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{e.event_type}</Badge>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("he-IL")}</span>
              <span className="mr-auto">{e.driver_name} · {e.driver_phone}</span>
            </div>
            <div className="whitespace-pre-wrap mt-1 text-foreground/80">{e.message}</div>
          </div>
        ))}
        {events.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">אין אירועים.</div>}
      </div>
    </Card>
  );
}
