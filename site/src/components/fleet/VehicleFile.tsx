import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Car } from "lucide-react";
import { fmtDate, fmtNum, kmUtilization, daysUntil, statusForDays } from "./utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FleetDriveDocuments } from "./FleetDriveDocuments";

export function VehicleFile({ vehicleId, onBack }: { vehicleId: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [v, setV] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [km, setKm] = useState<any[]>([]);
  const [maint, setMaint] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: vd } = await supabase.from("fleet_vehicles").select("*").eq("id", vehicleId).maybeSingle();
      setV(vd);
      if (vd?.driver_id) {
        const { data: dd } = await supabase.from("fleet_drivers").select("*").eq("id", vd.driver_id).maybeSingle();
        setDriver(dd);
      }
      const [a, k, m, f, i, d] = await Promise.all([
        supabase.from("fleet_driver_assignments").select("*, fleet_drivers(full_name)").eq("vehicle_id", vehicleId).order("start_date", { ascending: false }),
        supabase.from("fleet_km_monthly").select("*").eq("vehicle_id", vehicleId).order("year", { ascending: false }).order("month", { ascending: false }),
        supabase.from("fleet_maintenance").select("*").eq("vehicle_id", vehicleId).order("service_date", { ascending: false }),
        supabase.from("fleet_fines").select("*, fleet_drivers(full_name)").eq("vehicle_id", vehicleId).order("fine_date", { ascending: false }),
        supabase.from("fleet_incidents").select("*").eq("vehicle_id", vehicleId).order("incident_date", { ascending: false }),
        supabase.from("fleet_documents").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }),
      ]);
      setAssignments(a.data ?? []);
      setKm(k.data ?? []);
      setMaint(m.data ?? []);
      setFines(f.data ?? []);
      setIncidents(i.data ?? []);
      setDocs(d.data ?? []);
      setLoading(false);
    })();
  }, [vehicleId]);

  if (loading || !v) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-40" /></div>;

  const util = kmUtilization(v);
  const test = daysUntil(v.test_expiry_date);
  const ins = daysUntil(v.insurance_expiry_date);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowRight className="h-4 w-4 ml-1" /> חזרה לרשימה</Button>
        <Car className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">רכב {v.license_plate}</h2>
        <Badge variant={v.status === "active" ? "outline" : "secondary"}>{v.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">פרטי בסיס</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Info label="יצרן" value={v.make} />
            <Info label="דגם" value={v.model} />
            <Info label="שנה" value={v.year} />
            <Info label='ק"מ נוכחי' value={fmtNum(v.current_km)} />
            <Info label='ק"מ התחלתי' value={fmtNum(v.initial_km)} />
            <Info label="נהג נוכחי" value={driver?.full_name ?? "-"} />
            <Info label="טלפון נהג" value={driver?.phone ?? "-"} />
            <Info label="קוד איתוראן" value={v.ituran_code} />
          </dl>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">ליסינג</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Info label="חברה" value={v.leasing_company} />
            <Info label="תחילה" value={fmtDate(v.leasing_start_date)} />
            <Info label="חודשים" value={v.leasing_months} />
            <Info label="סיום מחושב" value={fmtDate(v.leasing_end_date)} />
            <Info label='מכסה שנתית' value={fmtNum(v.annual_km_limit)} />
            <Info label='מכסה כוללת' value={fmtNum(Math.round(util.totalLimit))} />
          </dl>
        </Card>

        <Card className="p-4 md:col-span-2">
          <h3 className="font-semibold mb-3">ניצול ק"מ</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>שנתי: {fmtNum(util.used)} / {fmtNum(util.annualLimit)} ק"מ</span>
                <Badge variant={util.status === "danger" ? "destructive" : util.status === "warn" ? "secondary" : "outline"}>{util.annualPct.toFixed(0)}%</Badge>
              </div>
              <Progress value={Math.min(100, util.annualPct)} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>תקופת ליסינג: {fmtNum(util.used)} / {fmtNum(Math.round(util.totalLimit))} ק"מ</span>
                <Badge variant={util.totalPct >= 100 ? "destructive" : util.totalPct >= 85 ? "secondary" : "outline"}>{util.totalPct.toFixed(0)}%</Badge>
              </div>
              <Progress value={Math.min(100, util.totalPct)} />
              <div className="text-xs text-muted-foreground mt-1">
                צפוי לפי חלוף זמן: {fmtNum(Math.round(util.expectedByNow))} ק"מ · חודשים חלפו: {util.monthsElapsed.toFixed(1)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">טסט וביטוח</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Info label="תוקף טסט" value={<Badge variant={statusForDays(test) === "expired" || statusForDays(test) === "danger" ? "destructive" : "outline"}>{fmtDate(v.test_expiry_date)}</Badge>} />
            <Info label="תוקף ביטוח" value={<Badge variant={statusForDays(ins) === "expired" || statusForDays(ins) === "danger" ? "destructive" : "outline"}>{fmtDate(v.insurance_expiry_date)}</Badge>} />
            <Info label="חברת ביטוח" value={v.insurance_company} />
          </dl>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">טיפול</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Info label="טיפול אחרון" value={fmtDate(v.last_maintenance_date)} />
            <Info label='ק"מ אחרון' value={fmtNum(v.last_maintenance_km)} />
            <Info label='כל כמה ק"מ' value={fmtNum(v.maintenance_interval_km)} />
            <Info label='ק"מ הבא' value={v.last_maintenance_km ? fmtNum(v.last_maintenance_km + (v.maintenance_interval_km ?? 15000)) : "-"} />
          </dl>
        </Card>
      </div>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList>
          <TabsTrigger value="assignments">היסטוריית נהגים ({assignments.length})</TabsTrigger>
          <TabsTrigger value="km">ק"מ חודשי ({km.length})</TabsTrigger>
          <TabsTrigger value="maint">טיפולים ({maint.length})</TabsTrigger>
          <TabsTrigger value="fines">קנסות ({fines.length})</TabsTrigger>
          <TabsTrigger value="incidents">תאונות ({incidents.length})</TabsTrigger>
          <TabsTrigger value="docs">מסמכים ({docs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <MiniTable rows={assignments} cols={[
            { h: "נהג", r: (a) => a.fleet_drivers?.full_name },
            { h: "מתאריך", r: (a) => fmtDate(a.start_date) },
            { h: "עד תאריך", r: (a) => a.end_date ? fmtDate(a.end_date) : <Badge variant="outline">נוכחי</Badge> },
            { h: 'ק"מ תחילה', r: (a) => fmtNum(a.start_km) },
            { h: 'ק"מ סיום', r: (a) => fmtNum(a.end_km) },
            { h: "סיבה", r: (a) => a.reason ?? "-" },
          ]} />
        </TabsContent>
        <TabsContent value="km">
          <MiniTable rows={km} cols={[
            { h: "שנה", r: (x) => x.year },
            { h: "חודש", r: (x) => x.month },
            { h: 'ק"מ', r: (x) => fmtNum(x.km) },
            { h: "מקור", r: (x) => x.source },
          ]} />
        </TabsContent>
        <TabsContent value="maint">
          <MiniTable rows={maint} cols={[
            { h: "תאריך", r: (x) => fmtDate(x.service_date) },
            { h: 'ק"מ', r: (x) => fmtNum(x.service_km) },
            { h: "סוג", r: (x) => x.service_type },
            { h: "מוסך", r: (x) => x.garage ?? "-" },
            { h: "עלות", r: (x) => x.cost ? `₪${fmtNum(x.cost)}` : "-" },
          ]} />
        </TabsContent>
        <TabsContent value="fines">
          <MiniTable rows={fines} cols={[
            { h: "תאריך", r: (x) => fmtDate(x.fine_date) },
            { h: "סכום", r: (x) => `₪${fmtNum(x.amount)}` },
            { h: "סיבה", r: (x) => x.reason ?? "-" },
            { h: "נהג באירוע", r: (x) => x.fleet_drivers?.full_name ?? "-" },
            { h: "סטטוס", r: (x) => <Badge variant={x.status === "paid" ? "outline" : "secondary"}>{x.status}</Badge> },
          ]} />
        </TabsContent>
        <TabsContent value="incidents">
          <MiniTable rows={incidents} cols={[
            { h: "תאריך", r: (x) => fmtDate(x.incident_date) },
            { h: "מיקום", r: (x) => x.location ?? "-" },
            { h: "תיאור", r: (x) => x.description ?? "-" },
            { h: "סטטוס", r: (x) => x.status },
          ]} />
        </TabsContent>
        <TabsContent value="docs">
          <div className="mt-2">
            <FleetDriveDocuments vehicleId={vehicleId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (<><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value ?? "-"}</dd></>);
}

function MiniTable({ rows, cols }: { rows: any[]; cols: { h: string; r: (row: any) => any }[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground p-4">אין נתונים.</p>;
  return (
    <Card className="overflow-x-auto mt-2">
      <Table>
        <TableHeader><TableRow>{cols.map((c, i) => <TableHead key={i}>{c.h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((r, i) => <TableRow key={r.id ?? i}>{cols.map((c, j) => <TableCell key={j}>{c.r(r)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </Card>
  );
}
