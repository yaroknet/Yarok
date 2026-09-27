import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "./utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { DriverDialog } from "./dialogs/DriverDialog";
import { ConfirmDelete } from "./dialogs/ConfirmDelete";
import { toast } from "sonner";

export function DriversScreen() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [openDriver, setOpenDriver] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [editItem, setEditItem] = useState<any | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  const load = async () => {
    const [d, v] = await Promise.all([
      supabase.from("fleet_drivers").select("*").order("full_name"),
      supabase.from("fleet_vehicles").select("id,license_plate,driver_id"),
    ]);
    setDrivers(d.data ?? []); setVehicles(v.data ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!openDriver) return;
    (async () => {
      const { data } = await supabase.from("fleet_driver_assignments")
        .select("*, fleet_vehicles(license_plate,make,model)")
        .eq("driver_id", openDriver.id).order("start_date", { ascending: false });
      setHistory(data ?? []);
    })();
  }, [openDriver]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return drivers;
    return drivers.filter(d => [d.full_name, d.phone, d.email].filter(Boolean).some(x => String(x).includes(q)));
  }, [drivers, query]);

  const currentVehicle = (id: string) => vehicles.find(v => v.driver_id === id)?.license_plate ?? "-";

  const doDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from("fleet_drivers").delete().eq("id", deleteItem.id);
    if (error) return toast.error(error.message);
    toast.success("הנהג נמחק"); setDeleteItem(null); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="חיפוש..." value={query} onChange={e => setQuery(e.target.value)} className="max-w-sm" />
        <div className="text-sm text-muted-foreground">{filtered.length} נהגים</div>
        <div className="mr-auto"><Button onClick={() => { setEditItem(undefined); setShowForm(true); }}><Plus className="h-4 w-4 ml-1" />נהג חדש</Button></div>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead><TableHead>טלפון</TableHead><TableHead>אימייל</TableHead>
              <TableHead>רכב</TableHead><TableHead>רישיון</TableHead><TableHead>תוקף רישיון</TableHead>
              <TableHead>סטטוס</TableHead><TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.full_name}</TableCell>
                <TableCell>{d.phone ?? "-"}</TableCell>
                <TableCell>{d.email ?? "-"}</TableCell>
                <TableCell className="font-mono">{currentVehicle(d.id)}</TableCell>
                <TableCell>{d.license_number ?? "-"}</TableCell>
                <TableCell>{fmtDate(d.license_expiry)}</TableCell>
                <TableCell><Badge variant={d.active ? "outline" : "secondary"}>{d.active ? "פעיל" : "לא פעיל"}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setOpenDriver(d)}><Eye className="h-4 w-4 ml-2" />היסטוריית רכבים</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditItem(d); setShowForm(true); }}><Pencil className="h-4 w-4 ml-2" />עריכה</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(d)}><Trash2 className="h-4 w-4 ml-2" />מחיקה</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">אין נהגים.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!openDriver} onOpenChange={o => !o && setOpenDriver(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader><DialogTitle>{openDriver?.full_name} — היסטוריית רכבים</DialogTitle></DialogHeader>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>רכב</TableHead><TableHead>יצרן/דגם</TableHead>
                <TableHead>מתאריך</TableHead><TableHead>עד תאריך</TableHead>
                <TableHead>ק"מ תחילה</TableHead><TableHead>ק"מ סיום</TableHead><TableHead>סיבה</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{h.fleet_vehicles?.license_plate}</TableCell>
                    <TableCell>{[h.fleet_vehicles?.make, h.fleet_vehicles?.model].filter(Boolean).join(" ")}</TableCell>
                    <TableCell>{fmtDate(h.start_date)}</TableCell>
                    <TableCell>{h.end_date ? fmtDate(h.end_date) : <Badge variant="outline">נוכחי</Badge>}</TableCell>
                    <TableCell>{h.start_km ?? "-"}</TableCell>
                    <TableCell>{h.end_km ?? "-"}</TableCell>
                    <TableCell>{h.reason ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">אין היסטוריה.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </DialogContent>
      </Dialog>

      {showForm && <DriverDialog open={showForm} onOpenChange={setShowForm} driver={editItem} onSaved={load} />}
      <ConfirmDelete open={!!deleteItem} onOpenChange={o => !o && setDeleteItem(null)} title={`מחיקת נהג ${deleteItem?.full_name}`} onConfirm={doDelete} />
    </div>
  );
}
