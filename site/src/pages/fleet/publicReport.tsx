import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Camera, AlertCircle, Car } from "lucide-react";
import { toast } from "sonner";

const FN_URL = `${SUPABASE_URL}/functions/v1/fleet-public-report`;
const ANON = SUPABASE_PUBLISHABLE_KEY;
const HDR = { apikey: ANON, Authorization: `Bearer ${ANON}` };

export function usePublicReport() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverId, setDriverId] = useState<string>("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [loadingV, setLoadingV] = useState(false);

  useEffect(() => {
    fetch(`${FN_URL}?action=drivers`, { headers: HDR })
      .then(r => r.json()).then(j => setDrivers(j.drivers ?? []))
      .catch(() => toast.error("שגיאה בטעינת נהגים"));
  }, []);

  useEffect(() => {
    if (!driverId) { setVehicles([]); setVehicleId(""); return; }
    setLoadingV(true);
    fetch(`${FN_URL}?action=driver_vehicle&driver_id=${driverId}`, { headers: HDR })
      .then(r => r.json()).then(j => {
        const vs = j.vehicles ?? [];
        setVehicles(vs);
        if (vs.length === 1) setVehicleId(vs[0].id);
        else setVehicleId("");
      }).finally(() => setLoadingV(false));
  }, [driverId]);

  return { drivers, driverId, setDriverId, vehicles, vehicleId, setVehicleId, loadingV };
}

export function DriverVehicleBlock(p: ReturnType<typeof usePublicReport>) {
  const sel = p.vehicles.find(v => v.id === p.vehicleId);
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">שם נהג *</Label>
        <Select value={p.driverId} onValueChange={p.setDriverId}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="בחר את שמך" /></SelectTrigger>
          <SelectContent>{p.drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {p.driverId && (
        p.loadingV ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> מאתר רכב פעיל...</div> :
        p.vehicles.length === 0 ? (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div><div className="font-medium">לא נמצא רכב פעיל</div><div className="text-xs opacity-80">פנה למשרד לשיוך רכב.</div></div>
          </div>
        ) : p.vehicles.length > 1 ? (
          <>
            <Label className="text-xs">רכב *</Label>
            <Select value={p.vehicleId} onValueChange={p.setVehicleId}>
              <SelectTrigger className="h-12"><SelectValue placeholder="בחר רכב" /></SelectTrigger>
              <SelectContent>{p.vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.license_plate} · {[v.make, v.model].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent>
            </Select>
            {sel && <ReadonlyCar v={sel} />}
          </>
        ) : sel && <ReadonlyCar v={sel} />
      )}
    </div>
  );
}

function ReadonlyCar({ v }: { v: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
      <Car className="h-5 w-5 text-primary shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">רכב {v.license_plate}</div>
        <div className="text-xs text-muted-foreground">{[v.make, v.model].filter(Boolean).join(" ") || "—"}{v.vehicle_type ? ` · ${v.vehicle_type}` : ""}</div>
      </div>
    </div>
  );
}

export async function uploadPublicFile(file: File, folder: string): Promise<string | null> {
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("fleet-files").upload(path, file, { upsert: false });
  if (error) { toast.error(error.message); return null; }
  const { data } = await supabase.storage.from("fleet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

export default function _(){ return null; }
export { FN_URL, HDR };
