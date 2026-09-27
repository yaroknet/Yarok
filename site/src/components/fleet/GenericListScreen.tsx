import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtNum } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "./dialogs/ConfirmDelete";
import { MaintenanceDialog } from "./dialogs/MaintenanceDialog";
import { FineDialog } from "./dialogs/FineDialog";
import { IncidentDialog } from "./dialogs/IncidentDialog";
import { DocumentDialog } from "./dialogs/DocumentDialog";
import { FleetAlertDialog } from "./dialogs/AlertDialog";
import { VehicleDamageMarker } from "./VehicleDamageMarker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Col = { h: string; r: (row: any) => any };

function useCatalogs() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [v, d] = await Promise.all([
        supabase.from("fleet_vehicles").select("id,license_plate,make,model,vehicle_type").order("license_plate"),
        supabase.from("fleet_drivers").select("id,full_name").order("full_name"),
      ]);
      setVehicles(v.data ?? []); setDrivers(d.data ?? []);
    })();
  }, []);
  return { vehicles, drivers };
}

function CrudScreen({
  title, table, select, orderBy, cols, searchKeys, emptyText,
  addLabel, DialogComp, extra,
}: {
  title: string; table: string; select: string; orderBy: { col: string; asc?: boolean };
  cols: Col[]; searchKeys: string[]; emptyText: string;
  addLabel: string; DialogComp: any; extra?: any;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const { vehicles, drivers } = useCatalogs();
  const [editItem, setEditItem] = useState<any | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from(table as any).select(select) as any).order(orderBy.col, { ascending: !!orderBy.asc });
    setRows(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [table]);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return rows;
    return rows.filter((r: any) => searchKeys.some(k => {
      const parts = k.split(".");
      let v: any = r;
      for (const p of parts) v = v?.[p];
      return v && String(v).includes(s);
    }));
  }, [rows, q, searchKeys]);

  const doDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from(table as any).delete().eq("id", deleteItem.id);
    if (error) return toast.error(error.message);
    toast.success("נמחק"); setDeleteItem(null); load();
  };

  const actionsCol: Col = {
    h: "פעולות",
    r: (row) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {extra?.onView && <DropdownMenuItem onClick={() => extra.onView(row)}><Pencil className="h-4 w-4 ml-2" />צפייה</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => { setEditItem(row); setShowForm(true); }}><Pencil className="h-4 w-4 ml-2" />עריכה</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(row)}><Trash2 className="h-4 w-4 ml-2" />מחיקה</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Input placeholder="חיפוש..." value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
        <div className="text-sm text-muted-foreground">{filtered.length}</div>
        <div className="mr-auto flex gap-2">
          {extra?.headerActions}
          <Button onClick={() => { setEditItem(undefined); setShowForm(true); }}><Plus className="h-4 w-4 ml-1" />{addLabel}</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <Table>
            <TableHeader><TableRow>{[...cols, actionsCol].map((c, i) => <TableHead key={i} className={i === cols.length ? "text-left" : ""}>{c.h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {filtered.map((row: any) => (
                <TableRow key={row.id}>{[...cols, actionsCol].map((c, j) => <TableCell key={j}>{c.r(row)}</TableCell>)}</TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-muted-foreground py-8">{emptyText}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>

      {showForm && <DialogComp open={showForm} onOpenChange={setShowForm} item={editItem} vehicles={vehicles} drivers={drivers} onSaved={load} />}
      <ConfirmDelete open={!!deleteItem} onOpenChange={o => !o && setDeleteItem(null)} onConfirm={doDelete} />
    </div>
  );
}

export function MaintenanceScreen() {
  return <CrudScreen
    title="טיפולים ואחזקה" table="fleet_maintenance"
    select="*, fleet_vehicles(license_plate)"
    orderBy={{ col: "service_date", asc: false }}
    searchKeys={["fleet_vehicles.license_plate", "service_type", "garage"]}
    addLabel="טיפול/פעולה חדשה" DialogComp={MaintenanceDialog}
    cols={[
      { h: "רכב", r: (x) => <span className="font-mono">{x.fleet_vehicles?.license_plate}</span> },
      { h: "תאריך", r: (x) => fmtDate(x.service_date) },
      { h: 'ק"מ', r: (x) => fmtNum(x.service_km) },
      { h: "סוג", r: (x) => x.service_type },
      { h: "מוסך", r: (x) => x.garage ?? "-" },
      { h: "עלות", r: (x) => x.cost ? `₪${fmtNum(x.cost)}` : "-" },
      { h: 'ק"מ הבא', r: (x) => fmtNum(x.next_due_km) },
      { h: "קובץ", r: (x) => x.invoice_url ? <a className="underline text-primary" href={x.invoice_url} target="_blank" rel="noreferrer">פתח</a> : "-" },
    ]}
    emptyText="אין רשומות טיפול."
  />;
}

export function FinesScreen() {
  return <CrudScreen
    title="קנסות" table="fleet_fines"
    select="*, fleet_vehicles(license_plate), fleet_drivers(full_name)"
    orderBy={{ col: "fine_date", asc: false }}
    searchKeys={["fleet_vehicles.license_plate", "fleet_drivers.full_name", "reference_number", "reason"]}
    addLabel="קנס חדש" DialogComp={FineDialog}
    cols={[
      { h: "תאריך", r: (x) => fmtDate(x.fine_date) },
      { h: "רכב", r: (x) => <span className="font-mono">{x.fleet_vehicles?.license_plate}</span> },
      { h: "נהג", r: (x) => x.fleet_drivers?.full_name ?? "-" },
      { h: "סכום", r: (x) => `₪${fmtNum(x.amount)}` },
      { h: "סיבה", r: (x) => x.reason ?? "-" },
      { h: "מספר", r: (x) => x.reference_number ?? "-" },
      { h: "סטטוס", r: (x) => <Badge variant={x.status === "paid" ? "outline" : "secondary"}>{x.status}</Badge> },
      { h: "קובץ", r: (x) => x.document_url ? <a className="underline text-primary" href={x.document_url} target="_blank" rel="noreferrer">פתח</a> : "-" },
    ]}
    emptyText="אין קנסות."
  />;
}

function IncidentViewDialog({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-3xl">
        <DialogHeader><DialogTitle>תאונה — {fmtDate(item.incident_date)}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="text-sm space-y-1">
            <div><b>מיקום:</b> {item.location ?? "-"}</div>
            <div><b>תיאור:</b> {item.description ?? "-"}</div>
            <div><b>צד ג':</b> {item.third_party?.text ?? "-"}</div>
            <div><b>דוח משטרה:</b> {item.police_report_number ?? "-"}</div>
            <div className="flex flex-wrap gap-2 pt-2">
              {(item.photos ?? []).map((p: string, i: number) => <a key={i} href={p} target="_blank" rel="noreferrer" className="underline text-primary text-xs">תמונה {i + 1}</a>)}
            </div>
          </div>
          <VehicleDamageMarker markers={item.damage_markers ?? []} readOnly onChange={() => {}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IncidentsScreen() {
  const [viewing, setViewing] = useState<any | null>(null);
  return (
    <>
      <CrudScreen
        title="תאונות" table="fleet_incidents"
        select="*, fleet_vehicles(license_plate), fleet_drivers(full_name)"
        orderBy={{ col: "incident_date", asc: false }}
        searchKeys={["fleet_vehicles.license_plate", "fleet_drivers.full_name", "location", "description"]}
        addLabel="דיווח תאונה חדש" DialogComp={IncidentDialog}
        extra={{ onView: setViewing }}
        cols={[
          { h: "תאריך", r: (x) => fmtDate(x.incident_date) },
          { h: "רכב", r: (x) => <span className="font-mono">{x.fleet_vehicles?.license_plate}</span> },
          { h: "נהג", r: (x) => x.fleet_drivers?.full_name ?? "-" },
          { h: "מיקום", r: (x) => x.location ?? "-" },
          { h: "תיאור", r: (x) => (x.description ?? "").slice(0, 60) },
          { h: "סטטוס", r: (x) => <Badge variant="outline">{x.status}</Badge> },
          { h: "סימוני נזק", r: (x) => Array.isArray(x.damage_markers) ? x.damage_markers.length : 0 },
        ]}
        emptyText="אין דיווחי תאונה."
      />
      {viewing && <IncidentViewDialog item={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

export { DocumentsScreen } from "./DocumentsScreenDrive";

export function AlertsScreen() {
  const createTest = async () => {
    const { error } = await supabase.from("fleet_alerts").insert({
      alert_type: "maintenance_due", dedup_key: `test:${Date.now()}`,
      severity: "info", title: "התראת בדיקה", body: "נוצרה ידנית לבדיקת חיבור N8N", status: "pending",
    });
    if (error) toast.error(error.message);
    else { toast.success("נוצרה התראת בדיקה"); location.reload(); }
  };
  return <CrudScreen
    title="התראות (הכנה ל-N8N)" table="fleet_alerts"
    select="*, fleet_vehicles(license_plate), fleet_drivers(full_name)"
    orderBy={{ col: "created_at", asc: false }}
    searchKeys={["title", "fleet_vehicles.license_plate", "fleet_drivers.full_name"]}
    addLabel="התראה חדשה" DialogComp={FleetAlertDialog}
    extra={{ headerActions: <Button variant="outline" onClick={createTest}>+ התראת בדיקה</Button> }}
    cols={[
      { h: "סוג", r: (x) => x.alert_type },
      { h: "רכב", r: (x) => x.fleet_vehicles?.license_plate ?? "-" },
      { h: "נהג", r: (x) => x.fleet_drivers?.full_name ?? "-" },
      { h: "כותרת", r: (x) => x.title },
      { h: "תאריך יעד", r: (x) => fmtDate(x.due_date) },
      { h: "חומרה", r: (x) => <Badge variant={x.severity === "danger" ? "destructive" : "secondary"}>{x.severity}</Badge> },
      { h: "סטטוס", r: (x) => <Badge variant="outline">{x.status}</Badge> },
    ]}
    emptyText="אין התראות."
  />;
}
