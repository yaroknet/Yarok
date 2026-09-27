import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUpload } from "./FileUpload";
import { DriverVehiclePicker } from "./DriverVehiclePicker";

const TYPES = ["טיפול תקופתי", "טסט", "תיקון", "החלפת חלק", "צמיגים", "אחר"];

export function MaintenanceDialog({ open, onOpenChange, item, vehicles, drivers = [], onSaved }: any) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setF(item ?? { service_date: new Date().toISOString().slice(0, 10), service_type: "טיפול תקופתי" });
  }, [item, open]);
  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  const save = async () => {
    if (!f.vehicle_id || !f.service_date || !f.service_type) { toast.error("חובה: רכב, תאריך וסוג"); return; }
    setSaving(true);
    const payload = {
      vehicle_id: f.vehicle_id, service_date: f.service_date, service_type: f.service_type,
      service_km: num(f.service_km), garage: f.garage || null, cost: num(f.cost),
      next_due_km: num(f.next_due_km), invoice_url: f.invoice_url || null, notes: f.notes || null,
    };
    const q = item
      ? supabase.from("fleet_maintenance").update(payload).eq("id", item.id)
      : supabase.from("fleet_maintenance").insert(payload);
    const { error } = await q;
    if (!error && !item && payload.service_km) {
      await supabase.from("fleet_vehicles").update({
        last_maintenance_date: payload.service_date,
        last_maintenance_km: payload.service_km,
      }).eq("id", payload.vehicle_id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("נשמר"); onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "עריכת טיפול" : "טיפול/פעולה חדשה"}</DialogTitle></DialogHeader>
        <div className="mb-3">
          <DriverVehiclePicker
            drivers={drivers}
            vehicles={vehicles}
            driverId={f.driver_id}
            vehicleId={f.vehicle_id}
            onChange={({ driverId, vehicleId }) => setF((p: any) => ({ ...p, driver_id: driverId, vehicle_id: vehicleId }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך *"><Input type="date" value={f.service_date ?? ""} onChange={e => s("service_date")(e.target.value)} /></Field>
          <Field label="סוג *">
            <Select value={f.service_type ?? ""} onValueChange={s("service_type")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label='ק"מ בזמן פעולה'><Input type="number" value={f.service_km ?? ""} onChange={e => s("service_km")(e.target.value)} /></Field>
          <Field label="מוסך/ספק"><Input value={f.garage ?? ""} onChange={e => s("garage")(e.target.value)} /></Field>
          <Field label="עלות ₪"><Input type="number" value={f.cost ?? ""} onChange={e => s("cost")(e.target.value)} /></Field>
          <Field label='ק"מ טיפול הבא'><Input type="number" value={f.next_due_km ?? ""} onChange={e => s("next_due_km")(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="קובץ/חשבונית"><FileUpload folder="maintenance" value={f.invoice_url} onChange={s("invoice_url")} /></Field></div>
          <div className="col-span-2"><Field label="הערות"><Textarea rows={2} value={f.notes ?? ""} onChange={e => s("notes")(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={saving} onClick={save}>{saving ? "שומר..." : "שמירה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({ label, children }: { label: string; children: any }) {
  return (<div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>);
}
