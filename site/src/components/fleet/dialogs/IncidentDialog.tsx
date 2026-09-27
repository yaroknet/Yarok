import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DriverVehiclePicker } from "./DriverVehiclePicker";
import { AccidentReportForm, AccidentPayload, Attachment } from "../AccidentReportForm";

export function IncidentDialog({ open, onOpenChange, item, vehicles, drivers, onSaved }: any) {
  const [driverId, setDriverId] = useState<string | null>(item?.driver_id ?? null);
  const [vehicleId, setVehicleId] = useState<string | null>(item?.vehicle_id ?? null);
  const [saving, setSaving] = useState(false);

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const path = `incidents/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("fleet-files").upload(path, file, { upsert: false });
    if (error) { toast.error(`${file.name}: ${error.message}`); return null; }
    const { data } = await supabase.storage.from("fleet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!data?.signedUrl) return null;
    return { url: data.signedUrl, name: file.name, type: file.type || "application/octet-stream" };
  };

  const onSubmit = async (p: AccidentPayload) => {
    if (!driverId || !vehicleId) { toast.error("חובה: נהג ורכב"); return false; }
    setSaving(true);
    const payload: any = {
      vehicle_id: vehicleId,
      driver_id: driverId,
      incident_date: p.incident_date,
      location: p.location,
      description: p.description,
      damage_markers: p.damage_markers,
      photos: p.attachments.map(a => a.url),
      attachments: p.attachments,
      third_party: p.third_party,
      police_report_number: p.police_report_number,
      status: p.status,
    };
    const q = item
      ? supabase.from("fleet_incidents").update(payload).eq("id", item.id)
      : supabase.from("fleet_incidents").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("הדיווח נשמר");
    onSaved();
    onOpenChange(false);
    return true;
  };

  const dLabel = drivers.find((x: any) => x.id === driverId)?.full_name ?? "-";
  const vLabel = vehicles.find((x: any) => x.id === vehicleId)?.license_plate ?? "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-base">{item ? "עריכת דיווח תאונה" : "דיווח תאונה חדש"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-4">
          <AccidentReportForm
            driverSlot={
              <DriverVehiclePicker
                drivers={drivers}
                vehicles={vehicles}
                driverId={driverId}
                vehicleId={vehicleId}
                onChange={({ driverId: d, vehicleId: v }) => { setDriverId(d); setVehicleId(v); }}
              />
            }
            driverId={driverId}
            vehicleId={vehicleId}
            driverLabel={dLabel}
            vehicleLabel={vLabel}
            initialItem={item}
            uploadFile={uploadFile}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            saving={saving}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
