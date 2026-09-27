import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function DriverDialog({ open, onOpenChange, driver, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; driver?: any; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(driver ?? { active: true }); }, [driver, open]);
  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.full_name?.trim()) { toast.error("חובה שם נהג"); return; }
    setSaving(true);
    const payload = {
      full_name: f.full_name.trim(), phone: f.phone || null, email: f.email || null,
      license_number: f.license_number || null, license_expiry: f.license_expiry || null,
      active: !!f.active, notes: f.notes || null,
    };
    const q = driver
      ? supabase.from("fleet_drivers").update(payload).eq("id", driver.id)
      : supabase.from("fleet_drivers").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(driver ? "הנהג עודכן" : "הנהג נוצר");
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{driver ? "עריכת נהג" : "נהג חדש"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם מלא *"><Input value={f.full_name ?? ""} onChange={e => s("full_name")(e.target.value)} /></Field>
          <Field label="טלפון / וואטסאפ"><Input value={f.phone ?? ""} onChange={e => s("phone")(e.target.value)} /></Field>
          <Field label="אימייל"><Input type="email" value={f.email ?? ""} onChange={e => s("email")(e.target.value)} /></Field>
          <Field label="מס' רישיון נהיגה"><Input value={f.license_number ?? ""} onChange={e => s("license_number")(e.target.value)} /></Field>
          <Field label="תוקף רישיון נהיגה"><Input type="date" value={f.license_expiry ?? ""} onChange={e => s("license_expiry")(e.target.value)} /></Field>
          <div className="flex items-center gap-2 pt-6"><Switch checked={!!f.active} onCheckedChange={s("active")} /><Label>פעיל</Label></div>
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
