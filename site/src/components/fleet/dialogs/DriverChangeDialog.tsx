import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function DriverChangeDialog({
  open, onOpenChange, vehicle, fromDriver, toDriver, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  vehicle: any; fromDriver: any; toDriver: any; onDone: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState<string>(String(vehicle?.current_km ?? ""));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!date || !km) { toast.error("חובה תאריך מעבר וק\"מ בזמן מעבר"); return; }
    setSaving(true);
    const kmNum = Number(km);
    // Close previous assignment
    const { error: e1 } = await supabase.from("fleet_driver_assignments")
      .update({ end_date: date, end_km: kmNum, notes: reason || null })
      .eq("vehicle_id", vehicle.id).is("end_date", null);
    if (e1) { toast.error(e1.message); setSaving(false); return; }

    // Create new assignment
    const { data: userData } = await supabase.auth.getUser();
    const { error: e2 } = await supabase.from("fleet_driver_assignments").insert({
      vehicle_id: vehicle.id, driver_id: toDriver.id,
      start_date: date, start_km: kmNum, reason: reason || null,
      created_by: userData?.user?.id,
    });
    if (e2) { toast.error(e2.message); setSaving(false); return; }

    // Update vehicle
    const { error: e3 } = await supabase.from("fleet_vehicles")
      .update({ driver_id: toDriver.id, current_km: Math.max(kmNum, vehicle.current_km ?? 0) })
      .eq("id", vehicle.id);
    if (e3) { toast.error(e3.message); setSaving(false); return; }

    setSaving(false);
    toast.success("שיוך הנהג הוחלף בהצלחה");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>החלפת נהג משויך לרכב</DialogTitle></DialogHeader>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            הרכב <b>{vehicle?.license_plate}</b> משויך כרגע ל<b>{fromDriver?.full_name ?? "-"}</b>.
            האם לסיים שיוך ולהעביר ל<b>{toDriver?.full_name}</b>?
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">תאריך מעבר</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">ק"מ בזמן מעבר</Label><Input type="number" value={km} onChange={e => setKm(e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">סיבה / הערות</Label><Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={saving} onClick={submit}>{saving ? "שומר..." : "אישור החלפה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
