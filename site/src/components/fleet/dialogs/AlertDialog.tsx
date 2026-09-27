import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYPES = ["test_expiry", "insurance_expiry", "maintenance_due", "fine", "km_overuse", "license_expiry"];
const SEV = ["info", "warn", "danger"];
const STATUS = ["pending", "sent", "dismissed", "resolved"];

export function FleetAlertDialog({ open, onOpenChange, item, vehicles, drivers, onSaved }: any) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(item ?? { alert_type: "maintenance_due", severity: "info", status: "pending" }); }, [item, open]);
  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title || !f.alert_type) { toast.error("חובה: סוג וכותרת"); return; }
    setSaving(true);
    const payload = {
      alert_type: f.alert_type, vehicle_id: f.vehicle_id || null, driver_id: f.driver_id || null,
      dedup_key: f.dedup_key || `manual:${crypto.randomUUID()}`,
      severity: f.severity, title: f.title, body: f.body || null,
      due_date: f.due_date || null, status: f.status,
    };
    const q = item
      ? supabase.from("fleet_alerts").update(payload).eq("id", item.id)
      : supabase.from("fleet_alerts").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("נשמר"); onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "עריכת התראה" : "התראה חדשה"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סוג *">
            <Select value={f.alert_type} onValueChange={s("alert_type")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="חומרה">
            <Select value={f.severity} onValueChange={s("severity")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEV.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="רכב">
            <Select value={f.vehicle_id ?? "none"} onValueChange={v => s("vehicle_id")(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא</SelectItem>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="נהג">
            <Select value={f.driver_id ?? "none"} onValueChange={v => s("driver_id")(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא</SelectItem>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="col-span-2"><Field label="כותרת *"><Input value={f.title ?? ""} onChange={e => s("title")(e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="פירוט"><Textarea rows={2} value={f.body ?? ""} onChange={e => s("body")(e.target.value)} /></Field></div>
          <Field label="תאריך יעד"><Input type="date" value={f.due_date ?? ""} onChange={e => s("due_date")(e.target.value)} /></Field>
          <Field label="סטטוס">
            <Select value={f.status} onValueChange={s("status")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
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
