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

const STATUSES = [{ v: "open", l: "פתוח" }, { v: "paid", l: "שולם" }, { v: "transferred", l: "הוסב" }, { v: "cancelled", l: "בוטל" }];

export function FineDialog({ open, onOpenChange, item, vehicles, drivers = [], onSaved }: any) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setF(item ?? { fine_date: new Date().toISOString().slice(0, 10), status: "open" });
  }, [item, open]);
  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  const save = async () => {
    if (!f.driver_id || !f.vehicle_id || !f.fine_date || f.amount == null || f.amount === "") { toast.error("חובה: נהג, רכב, תאריך וסכום"); return; }
    setSaving(true);
    const payload = {
      vehicle_id: f.vehicle_id, driver_id: f.driver_id || null, fine_date: f.fine_date, amount: Number(f.amount),
      reason: f.reason || null, reference_number: f.reference_number || null,
      location: f.location || null, due_date: f.due_date || null, paid_at: f.paid_at || null,
      status: f.status, document_url: f.document_url || null, notes: f.notes || null,
    };
    const q = item
      ? supabase.from("fleet_fines").update(payload).eq("id", item.id)
      : supabase.from("fleet_fines").insert(payload).select("id").single();
    const { error } = await q as any;

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("נשמר"); onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "עריכת קנס" : "קנס חדש"}</DialogTitle></DialogHeader>
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
          <Field label="מספר דוח"><Input value={f.reference_number ?? ""} onChange={e => s("reference_number")(e.target.value)} /></Field>
          <Field label="תאריך עבירה *"><Input type="date" value={f.fine_date ?? ""} onChange={e => s("fine_date")(e.target.value)} /></Field>
          <Field label="מיקום"><Input value={f.location ?? ""} onChange={e => s("location")(e.target.value)} /></Field>
          <Field label="סוג עבירה"><Input value={f.reason ?? ""} onChange={e => s("reason")(e.target.value)} /></Field>
          <Field label="סכום ₪ *"><Input type="number" value={f.amount ?? ""} onChange={e => s("amount")(e.target.value)} /></Field>
          <Field label="מועד תשלום אחרון"><Input type="date" value={f.due_date ?? ""} onChange={e => s("due_date")(e.target.value)} /></Field>
          <Field label="תאריך תשלום"><Input type="date" value={f.paid_at ?? ""} onChange={e => s("paid_at")(e.target.value)} /></Field>
          <Field label="סטטוס">
            <Select value={f.status ?? "open"} onValueChange={s("status")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="col-span-2"><Field label="צילום/קובץ קנס"><FileUpload folder="fines" value={f.document_url} onChange={s("document_url")} /></Field></div>
          <div className="col-span-2"><Field label="הערות"><Textarea rows={2} value={f.notes ?? ""} onChange={e => s("notes")(e.target.value)} /></Field></div>
        </div>
        <div className="text-xs text-muted-foreground">הרכב מתמלא אוטומטית לפי הנהג שנבחר (רכב פעיל).</div>
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
