import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysUntil, statusForDays, fmtDate, fmtNum, kmUtilization } from "./utils";
import { VehicleFile } from "./VehicleFile";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pencil, Plus, Trash2, MoreHorizontal } from "lucide-react";
import { VehicleDialog } from "./dialogs/VehicleDialog";
import { ConfirmDelete } from "./dialogs/ConfirmDelete";
import { toast } from "sonner";

export function VehiclesScreen() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverMap, setDriverMap] = useState<Record<string, any>>({});
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const [v, d] = await Promise.all([
      supabase.from("fleet_vehicles").select("*").order("license_plate"),
      supabase.from("fleet_drivers").select("id,full_name,phone").order("full_name"),
    ]);
    setVehicles(v.data ?? []);
    setDrivers(d.data ?? []);
    const map: Record<string, any> = {};
    (d.data ?? []).forEach((x: any) => (map[x.id] = x));
    setDriverMap(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return vehicles;
    return vehicles.filter(v =>
      [v.license_plate, v.make, v.model, v.leasing_company, driverMap[v.driver_id]?.full_name]
        .filter(Boolean).some(x => String(x).includes(q))
    );
  }, [vehicles, query, driverMap]);

  const doDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from("fleet_vehicles").delete().eq("id", deleteItem.id);
    if (error) return toast.error(error.message);
    toast.success("הרכב נמחק"); setDeleteItem(null); load();
  };

  if (openId) return <VehicleFile vehicleId={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="חיפוש..." value={query} onChange={e => setQuery(e.target.value)} className="max-w-sm" />
        <div className="text-sm text-muted-foreground">{filtered.length} רכבים</div>
        <div className="mr-auto">
          <Button onClick={() => { setEditItem(undefined); setShowForm(true); }}><Plus className="h-4 w-4 ml-1" />רכב חדש</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מספר רכב</TableHead>
                <TableHead>נהג</TableHead>
                <TableHead>יצרן/דגם</TableHead>
                <TableHead>ליסינג/בעלות</TableHead>
                <TableHead>חברת ביטוח</TableHead>
                <TableHead>ק"מ נוכחי</TableHead>
                <TableHead>ניצול</TableHead>
                <TableHead>טסט</TableHead>
                <TableHead>ביטוח</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(v => {
                const util = kmUtilization(v);
                const test = daysUntil(v.test_expiry_date);
                const ins = daysUntil(v.insurance_expiry_date);
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <button
                        onClick={() => setOpenId(v.id)}
                        className="font-mono font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                        title="פתיחת תיק רכב"
                      >
                        {v.license_plate}
                      </button>
                    </TableCell>
                    <TableCell>{driverMap[v.driver_id]?.full_name ?? "-"}</TableCell>
                    <TableCell>{[v.make, v.model].filter(Boolean).join(" ") || "-"}</TableCell>
                    <TableCell>{v.leasing_company ?? "-"}</TableCell>
                    <TableCell>{v.insurance_company ?? "-"}</TableCell>
                    <TableCell>{fmtNum(v.current_km)}</TableCell>
                    <TableCell>
                      <Badge variant={util.status === "danger" ? "destructive" : util.status === "warn" ? "secondary" : "outline"}>
                        {util.totalPct.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell><DateBadge date={v.test_expiry_date} days={test} /></TableCell>
                    <TableCell><DateBadge date={v.insurance_expiry_date} days={ins} /></TableCell>
                    <TableCell><Badge variant={v.status === "active" ? "outline" : "secondary"}>{v.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditItem(v); setShowForm(true); }}><Pencil className="h-4 w-4 ml-2" />עריכה</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(v)}><Trash2 className="h-4 w-4 ml-2" />מחיקה</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">אין רכבים.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {showForm && <VehicleDialog open={showForm} onOpenChange={setShowForm} vehicle={editItem} drivers={drivers} onSaved={load} />}
      <ConfirmDelete open={!!deleteItem} onOpenChange={o => !o && setDeleteItem(null)} title={`מחיקת רכב ${deleteItem?.license_plate}`} description="כל הרשומות המקושרות (טיפולים, קנסות, תאונות וכו') יימחקו יחד עם הרכב." onConfirm={doDelete} />
    </div>
  );
}

function DateBadge({ date, days }: { date?: string | null; days: number | null }) {
  const s = statusForDays(days);
  const variant = s === "expired" ? "destructive" : s === "danger" ? "destructive" : s === "warn" ? "secondary" : "outline";
  return <Badge variant={variant as any}>{fmtDate(date)}</Badge>;
}
