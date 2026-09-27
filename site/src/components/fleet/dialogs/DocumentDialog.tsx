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

const TYPES = ["רישיון רכב", "ביטוח", "רישיון נהיגה", "טפסי מסירה/החזרה", "ייפוי כוח", "קנסות", "טיפולים", "אחר"];

export function DocumentDialog({ open, onOpenChange, item, vehicles, drivers, onSaved }: any) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(item ?? { doc_type: "רישיון רכב" }); }, [item, open]);
  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title || !f.doc_type || !f.file_url) { toast.error("חובה: כותרת, סוג וקובץ"); return; }
    setSaving(true);
    const payload = {
      vehicle_id: f.vehicle_id || null, driver_id: f.driver_id || null,
      doc_type: f.doc_type, title: f.title, file_url: f.file_url,
      expiry_date: f.expiry_date || null, notes: f.notes || null,
    };
    const q = item
      ? supabase.from("fleet_documents").update(payload).eq("id", item.id)
      : supabase.from("fleet_documents").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("נשמר"); onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "עריכת מסמך" : "מסמך חדש"}</DialogTitle></DialogHeader>
        <div className="mb-3">
          <DriverVehiclePicker
            drivers={drivers}
            vehicles={vehicles}
            driverId={f.driver_id}
            vehicleId={f.vehicle_id}
            driverRequired={false}
            vehicleRequired={false}
            onChange={({ driverId, vehicleId }) => setF((p: any) => ({ ...p, driver_id: driverId, vehicle_id: vehicleId }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סוג מסמך *">
            <Select value={f.doc_type ?? ""} onValueChange={s("doc_type")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="תוקף"><Input type="date" value={f.expiry_date ?? ""} onChange={e => s("expiry_date")(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="כותרת *"><Input value={f.title ?? ""} onChange={e => s("title")(e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="קובץ *"><FileUpload folder="documents" value={f.file_url} onChange={s("file_url")} /></Field></div>
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
