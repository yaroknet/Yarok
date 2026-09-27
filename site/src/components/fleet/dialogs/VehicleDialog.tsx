import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DriverChangeDialog } from "./DriverChangeDialog";

const OWNERSHIPS = [{ v: "company", l: "חברה" }, { v: "leasing", l: "ליסינג" }, { v: "private", l: "פרטית" }];
const STATUSES = [{ v: "active", l: "פעיל" }, { v: "in_service", l: "במוסך" }, { v: "inactive", l: "לא פעיל" }, { v: "sold", l: "נמכר" }, { v: "totaled", l: "טוטאל לוס" }];

export function VehicleDialog({
  open, onOpenChange, vehicle, drivers, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; vehicle?: any; drivers: any[]; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [changeDriver, setChangeDriver] = useState<{ from: any; to: any } | null>(null);

  useEffect(() => {
    setF(vehicle ?? { ownership_type: "leasing", status: "active", leasing_months: 36, maintenance_interval_km: 15000, current_km: 0, initial_km: 0 });
  }, [vehicle, open]);

  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  const strOrNull = (v: any) => (v === "" || v == null ? null : v);

  const save = async () => {
    if (!f.license_plate) { toast.error("חובה למלא מספר רכב"); return; }
    setSaving(true);
    const payload: any = {
      license_plate: f.license_plate.trim(),
      make: strOrNull(f.make), model: strOrNull(f.model), year: num(f.year),
      ownership_type: f.ownership_type, leasing_company: strOrNull(f.leasing_company),
      leasing_start_date: strOrNull(f.leasing_start_date), leasing_months: num(f.leasing_months),
      annual_km_limit: num(f.annual_km_limit),
      initial_km: num(f.initial_km) ?? 0, current_km: num(f.current_km) ?? 0,
      test_expiry_date: strOrNull(f.test_expiry_date),
      insurance_company: strOrNull(f.insurance_company), insurance_expiry_date: strOrNull(f.insurance_expiry_date),
      last_maintenance_date: strOrNull(f.last_maintenance_date), last_maintenance_km: num(f.last_maintenance_km),
      maintenance_interval_km: num(f.maintenance_interval_km) ?? 15000,
      ituran_code: strOrNull(f.ituran_code), notes: strOrNull(f.notes),
      status: f.status,
    };

    // Driver-change guardrail
    if (vehicle && vehicle.driver_id && f.driver_id && vehicle.driver_id !== f.driver_id) {
      const from = drivers.find(d => d.id === vehicle.driver_id);
      const to = drivers.find(d => d.id === f.driver_id);
      setChangeDriver({ from, to });
      setSaving(false);
      return;
    }
    payload.driver_id = f.driver_id || null;

    const q = vehicle
      ? supabase.from("fleet_vehicles").update(payload).eq("id", vehicle.id)
      : supabase.from("fleet_vehicles").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(vehicle ? "הרכב עודכן" : "הרכב נוצר");
    onSaved(); onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{vehicle ? `עריכת רכב ${vehicle.license_plate}` : "רכב חדש"}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="מספר רכב *"><Input value={f.license_plate ?? ""} onChange={e => s("license_plate")(e.target.value)} /></Field>
            <Field label="נהג משויך">
              <Select value={f.driver_id ?? "none"} onValueChange={v => s("driver_id")(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent><SelectItem value="none">ללא נהג</SelectItem>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="סטטוס">
              <Select value={f.status ?? "active"} onValueChange={s("status")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <Field label="יצרן"><Input value={f.make ?? ""} onChange={e => s("make")(e.target.value)} /></Field>
            <Field label="דגם"><Input value={f.model ?? ""} onChange={e => s("model")(e.target.value)} /></Field>
            <Field label="שנה"><Input type="number" value={f.year ?? ""} onChange={e => s("year")(e.target.value)} /></Field>

            <Field label="סוג בעלות">
              <Select value={f.ownership_type ?? "leasing"} onValueChange={s("ownership_type")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OWNERSHIPS.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="חברת ליסינג"><Input value={f.leasing_company ?? ""} onChange={e => s("leasing_company")(e.target.value)} /></Field>
            <Field label="קוד איתוראן"><Input value={f.ituran_code ?? ""} onChange={e => s("ituran_code")(e.target.value)} /></Field>

            <Field label="תחילת ליסינג"><Input type="date" value={f.leasing_start_date ?? ""} onChange={e => s("leasing_start_date")(e.target.value)} /></Field>
            <Field label="חודשי ליסינג"><Input type="number" value={f.leasing_months ?? ""} onChange={e => s("leasing_months")(e.target.value)} /></Field>
            <Field label='מכסה שנתית (ק"מ)'><Input type="number" value={f.annual_km_limit ?? ""} onChange={e => s("annual_km_limit")(e.target.value)} /></Field>

            <Field label='ק"מ התחלתי'><Input type="number" value={f.initial_km ?? ""} onChange={e => s("initial_km")(e.target.value)} /></Field>
            <Field label='ק"מ נוכחי'><Input type="number" value={f.current_km ?? ""} onChange={e => s("current_km")(e.target.value)} /></Field>
            <Field label='כל כמה ק"מ טיפול'><Input type="number" value={f.maintenance_interval_km ?? ""} onChange={e => s("maintenance_interval_km")(e.target.value)} /></Field>

            <Field label="תוקף טסט"><Input type="date" value={f.test_expiry_date ?? ""} onChange={e => s("test_expiry_date")(e.target.value)} /></Field>
            <Field label="חברת ביטוח"><Input value={f.insurance_company ?? ""} onChange={e => s("insurance_company")(e.target.value)} /></Field>
            <Field label="תוקף ביטוח"><Input type="date" value={f.insurance_expiry_date ?? ""} onChange={e => s("insurance_expiry_date")(e.target.value)} /></Field>

            <Field label="תאריך טיפול אחרון"><Input type="date" value={f.last_maintenance_date ?? ""} onChange={e => s("last_maintenance_date")(e.target.value)} /></Field>
            <Field label='ק"מ טיפול אחרון'><Input type="number" value={f.last_maintenance_km ?? ""} onChange={e => s("last_maintenance_km")(e.target.value)} /></Field>

            <div className="col-span-full">
              <Field label="הערות"><Textarea rows={2} value={f.notes ?? ""} onChange={e => s("notes")(e.target.value)} /></Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button disabled={saving} onClick={save}>{saving ? "שומר..." : "שמירה"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {changeDriver && (
        <DriverChangeDialog
          open={!!changeDriver}
          onOpenChange={(o) => !o && setChangeDriver(null)}
          vehicle={vehicle}
          fromDriver={changeDriver.from}
          toDriver={changeDriver.to}
          onDone={() => { setChangeDriver(null); onSaved(); onOpenChange(false); }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (<div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>);
}
