import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { DriverVehicleBlock, usePublicReport, uploadPublicFile, FN_URL, HDR } from "./publicReport";

export default function KmReportPublic() {
  const dv = usePublicReport();
  const [km, setKm] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    const url = await uploadPublicFile(file, "public-km");
    if (url) setPhotoUrl(url);
    setUploading(false);
  };

  const submit = async () => {
    if (!dv.driverId || !dv.vehicleId) return toast.error("בחר נהג ורכב");
    const kmNum = Number(km);
    if (!km || !Number.isFinite(kmNum) || kmNum <= 0) return toast.error('ק"מ לא תקין');
    const lastKm = Number(sel?.current_km ?? 0);
    if (lastKm && kmNum < lastKm) return toast.error('הק״מ שהוזן נמוך מהק״מ האחרון במערכת');
    if (!photoUrl) return toast.error("חובה לצלם את מד הק\"מ");
    setSaving(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST", headers: { ...HDR, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "km", driver_id: dv.driverId, vehicle_id: dv.vehicleId,
          current_km: kmNum, odometer_image: photoUrl, note, submitted_by_name: name,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "שגיאה");
      setDone(true);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const sel = dv.vehicles.find(v => v.id === dv.vehicleId);

  if (done) return (
    <div dir="rtl" className="min-h-screen bg-muted/30 p-4"><div className="max-w-md mx-auto"><Card className="p-6 text-center space-y-3">
      <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
      <div className="font-semibold text-lg">✅ הדיווח התקבל בהצלחה</div>
      <div className="text-sm text-muted-foreground">ק"מ שדווח: {Number(km).toLocaleString()}</div>
    </Card></div></div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card className="p-5 text-center bg-primary text-primary-foreground">
          <div className="text-2xl">🚗</div>
          <h1 className="text-lg font-bold mt-1">דיווח קילומטרז׳</h1>
        </Card>

        <Card className="p-5 space-y-4">
          <DriverVehicleBlock {...dv} />
        </Card>

        <Card className="p-5 space-y-4">
          {sel?.current_km ? (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm flex justify-between">
              <span className="text-muted-foreground">ק״מ אחרון במערכת</span>
              <span className="font-semibold">{Number(sel.current_km).toLocaleString()}</span>
            </div>
          ) : null}
          <div>
            <Label className="text-xs">הזן ק״מ נוכחי *</Label>
            <Input type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} placeholder="הזן ק״מ נוכחי" className="text-2xl h-14 text-center font-mono" />
          </div>

          <div>
            <Label className="text-xs">צילום מד הק"מ *</Label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50">
              {photoUrl ? <img src={photoUrl} alt="מד ק״מ" className="max-h-40 rounded" /> :
                uploading ? <Loader2 className="h-6 w-6 animate-spin" /> :
                <><Camera className="h-8 w-8 text-muted-foreground" /><span className="text-sm">לחץ לצילום</span></>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>

          <div><Label className="text-xs">הערה</Label><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="לא חובה" /></div>
          <div><Label className="text-xs">שם המדווח</Label><Input className="h-11" value={name} onChange={e => setName(e.target.value)} placeholder="שמך" /></div>

          <Button className="w-full h-12 text-base" onClick={submit} disabled={saving || uploading || !dv.driverId || !dv.vehicleId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />} שליחת דיווח
          </Button>
        </Card>
      </div>
    </div>
  );
}
