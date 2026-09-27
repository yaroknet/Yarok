import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DriverVehicleBlock, usePublicReport, uploadPublicFile, FN_URL, HDR } from "./publicReport";
import { AccidentReportForm, AccidentPayload, Attachment } from "@/components/fleet/AccidentReportForm";

export default function IncidentReportPublic() {
  const dv = usePublicReport();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const url = await uploadPublicFile(file, "public-incidents");
    if (!url) return null;
    return { url, name: file.name, type: file.type || "application/octet-stream" };
  };

  const onSubmit = async (p: AccidentPayload) => {
    if (!dv.driverId || !dv.vehicleId) { toast.error("בחר נהג ורכב"); return false; }
    setSaving(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST", headers: { ...HDR, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "incident",
          driver_id: dv.driverId,
          vehicle_id: dv.vehicleId,
          incident_date: p.incident_date,
          location: p.location,
          description: p.description,
          attachments: p.attachments,
          damage_markers: p.damage_markers,
          third_party: p.third_party,
          submitted_by_name: p.submitted_by_name ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "שגיאה");
      setDone(true);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (done) return (
    <Wrap>
      <Card className="p-6 text-center space-y-3">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
        <div className="font-semibold text-lg">✅ דיווח התאונה התקבל בהצלחה</div>
        <div className="text-sm text-muted-foreground">תודה על שיתוף הפעולה</div>
      </Card>
    </Wrap>
  );

  const sel = dv.vehicles.find(v => v.id === dv.vehicleId);
  const driverName = dv.drivers.find(d => d.id === dv.driverId)?.full_name ?? "-";
  const vehicleLabel = sel ? `${sel.license_plate}${sel.make || sel.model ? ` · ${[sel.make, sel.model].filter(Boolean).join(" ")}` : ""}` : "-";

  return (
    <Wrap>
      <Card className="p-5 text-center bg-primary text-primary-foreground">
        <div className="text-2xl">🚨</div>
        <h1 className="text-lg font-bold mt-1">דיווח תאונה</h1>
        <div className="text-xs opacity-90">מלא את הפרטים ושלח</div>
      </Card>

      <Card className="p-4 min-h-[70vh] flex flex-col">
        <AccidentReportForm
          driverSlot={<DriverVehicleBlock {...dv} />}
          driverId={dv.driverId || null}
          vehicleId={dv.vehicleId || null}
          driverLabel={driverName}
          vehicleLabel={vehicleLabel}
          uploadFile={uploadFile}
          onSubmit={onSubmit}
          showReporterName
          showStatus={false}
          saving={saving}
        />
      </Card>
    </Wrap>
  );
}

function Wrap({ children }: { children: any }) {
  return <div dir="rtl" className="min-h-screen bg-muted/30 p-4"><div className="max-w-md mx-auto space-y-4">{children}</div></div>;
}
