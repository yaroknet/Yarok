import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Loader2, Car } from "lucide-react";

/**
 * Driver-first picker:
 * 1. Choose driver.
 * 2. Auto-load vehicles currently assigned to that driver (fleet_driver_assignments).
 *    - 1 active vehicle → auto-select & show read-only.
 *    - 0 active vehicles → show warning + optional "unassign / open assignment".
 *    - >1 active vehicles → show a select scoped to the driver's vehicles only.
 *
 * Props:
 *  drivers, vehicles: preloaded arrays
 *  driverId, vehicleId: current values
 *  onChange({driverId, vehicleId})
 *  driverRequired (default true)
 *  vehicleRequired (default true)
 */
export function DriverVehiclePicker({
  drivers,
  vehicles,
  driverId,
  vehicleId,
  onChange,
  driverRequired = true,
  vehicleRequired = true,
}: {
  drivers: any[];
  vehicles: any[];
  driverId?: string | null;
  vehicleId?: string | null;
  onChange: (v: { driverId: string | null; vehicleId: string | null }) => void;
  driverRequired?: boolean;
  vehicleRequired?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [activeVehicleIds, setActiveVehicleIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!driverId) {
      setActiveVehicleIds([]);
      setLoaded(false);
      return;
    }
    setLoading(true);
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("fleet_driver_assignments")
        .select("vehicle_id, start_date, end_date")
        .eq("driver_id", driverId);
      if (cancelled) return;
      setLoading(false);
      setLoaded(true);
      if (error) { setActiveVehicleIds([]); return; }
      const active = (data ?? []).filter((r: any) =>
        (!r.start_date || r.start_date <= today) &&
        (!r.end_date || r.end_date >= today)
      );
      const ids = Array.from(new Set(active.map((r: any) => r.vehicle_id)));
      setActiveVehicleIds(ids);
      // auto-pick single vehicle
      if (ids.length === 1 && vehicleId !== ids[0]) {
        onChange({ driverId, vehicleId: ids[0] });
      } else if (ids.length === 0 && vehicleId) {
        onChange({ driverId, vehicleId: null });
      } else if (ids.length > 1 && vehicleId && !ids.includes(vehicleId)) {
        onChange({ driverId, vehicleId: null });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const activeVehicles = vehicles.filter((v: any) => activeVehicleIds.includes(v.id));
  const selectedVehicle = vehicles.find((v: any) => v.id === vehicleId);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">נהג {driverRequired && "*"}</Label>
        <Select value={driverId ?? ""} onValueChange={v => onChange({ driverId: v || null, vehicleId: null })}>
          <SelectTrigger className="h-11"><SelectValue placeholder="בחר נהג" /></SelectTrigger>
          <SelectContent>
            {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {driverId && (
        <div className="space-y-1">
          <Label className="text-xs">רכב {vehicleRequired && "*"}</Label>

          {loading && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/40 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> מאתר רכב פעיל...
            </div>
          )}

          {!loading && loaded && activeVehicles.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">לא נמצא רכב פעיל לנהג זה</div>
                <div className="text-xs opacity-80">יש לשייך רכב לנהג במסך הנהגים לפני המשך.</div>
              </div>
            </div>
          )}

          {!loading && activeVehicles.length === 1 && selectedVehicle && (
            <ReadonlyVehicleCard v={selectedVehicle} />
          )}

          {!loading && activeVehicles.length > 1 && (
            <>
              <Select value={vehicleId ?? ""} onValueChange={v => onChange({ driverId, vehicleId: v || null })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="בחר רכב פעיל" /></SelectTrigger>
                <SelectContent>
                  {activeVehicles.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.license_plate} · {[v.make, v.model].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVehicle && <ReadonlyVehicleCard v={selectedVehicle} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReadonlyVehicleCard({ v }: { v: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <Car className="h-5 w-5 text-primary shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">רכב {v.license_plate}</div>
        <div className="text-xs text-muted-foreground">
          {[v.make, v.model].filter(Boolean).join(" ") || "—"}
          {v.vehicle_type ? ` · ${v.vehicle_type}` : ""}
        </div>
      </div>
    </div>
  );
}
