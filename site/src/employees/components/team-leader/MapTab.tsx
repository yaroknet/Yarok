import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { TeamTask } from "@/employees/hooks/useTeamTasks";
import { Button } from "@/employees/components/ui/button";
import { Locate, Route, X } from "lucide-react";
import { toast } from "sonner";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const taskIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  let color = "#16a34a";
  let size = 40;
  if (count >= 20) { color = "#dc2626"; size = 56; }
  else if (count >= 10) { color = "#ea580c"; size = 48; }
  return L.divIcon({
    html: `<div style="background:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${size > 48 ? 18 : 14}px;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:3px solid white">${count}</div>`,
    className: "",
    iconSize: L.point(size, size),
  });
}

// Nearest-neighbor TSP approximation
function optimizeRoute(start: [number, number], points: { latlng: [number, number]; task: TeamTask }[]) {
  if (points.length === 0) return [];
  const remaining = [...points];
  const ordered: typeof points = [];
  let current = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current, remaining[i].latlng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    ordered.push(remaining[nearestIdx]);
    current = remaining[nearestIdx].latlng;
    remaining.splice(nearestIdx, 1);
  }
  return ordered;
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Numbered marker for route
function numberedIcon(n: number) {
  return L.divIcon({
    html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white">${n}</div>`,
    className: "",
    iconSize: L.point(32, 32),
    iconAnchor: L.point(16, 16),
    popupAnchor: L.point(0, -16),
  });
}

interface MapTabProps {
  tasks: TeamTask[];
  onSelectTask: (task: TeamTask) => void;
}

export function MapTab({ tasks, onSelectTask }: MapTabProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const clusterRef = useRef<any>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const [routeActive, setRouteActive] = useState(false);

  const openTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.branches?.lat && t.branches?.lng
  );

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [31.77, 35.21], zoom: 8, zoomControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    L.control.zoom({ position: "topleft" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Add markers with clustering
  useEffect(() => {
    const map = mapRef.current;
    if (!map || routeActive) return;

    if (clusterRef.current) map.removeLayer(clusterRef.current);

    const clusterGroup = (L as any).markerClusterGroup({
      iconCreateFunction: createClusterIcon,
      maxClusterRadius: 60, spiderfyOnMaxZoom: true,
      showCoverageOnHover: false, zoomToBoundsOnClick: true,
    });

    openTasks.forEach((t) => {
      const marker = L.marker([t.branches!.lat!, t.branches!.lng!], { icon: taskIcon });
      const popupContent = document.createElement("div");
      popupContent.dir = "rtl";
      popupContent.style.textAlign = "right";
      popupContent.style.minWidth = "160px";
      popupContent.innerHTML = `
        <p style="font-weight:700;font-size:14px;margin:0 0 4px">${t.branches?.networks?.name || ""}</p>
        <p style="font-size:12px;color:#666;margin:0 0 4px">${t.branches?.name || ""}</p>
        <p style="font-size:12px;color:#888;margin:0 0 8px">${t.work_type}</p>`;
      const btn = document.createElement("button");
      btn.textContent = "צפה במשימה";
      btn.style.cssText = "background:#16a34a;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%";
      btn.onclick = () => onSelectTask(t);
      popupContent.appendChild(btn);
      marker.bindPopup(popupContent);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    if (openTasks.length > 0) {
      const bounds = L.latLngBounds(openTasks.map((t) => [t.branches!.lat!, t.branches!.lng!]));
      if (userPos) bounds.extend(userPos);
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => { if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; } };
  }, [openTasks, userPos, routeActive]);

  // User location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    if (userMarkerRef.current) userMarkerRef.current.setLatLng(userPos);
    else {
      userMarkerRef.current = L.marker(userPos, { icon: userIcon }).addTo(map).bindPopup("המיקום שלי");
    }
    return () => { if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; } };
  }, [userPos]);

  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude]; setUserPos(ll); mapRef.current?.flyTo(ll, 14); },
      () => {}, { enableHighAccuracy: true }
    );
  };

  const showOptimizedRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (openTasks.length === 0) { toast.error("אין משימות עם מיקום להצגה"); return; }

    const start: [number, number] = userPos || [openTasks[0].branches!.lat!, openTasks[0].branches!.lng!];
    if (!userPos) toast("המסלול מתחיל מהמשימה הראשונה. אשר מיקום לתוצאה מדויקת יותר.");

    const points = openTasks.map((t) => ({
      latlng: [t.branches!.lat!, t.branches!.lng!] as [number, number],
      task: t,
    }));

    const ordered = optimizeRoute(start, points);

    // Remove cluster, show route
    if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; }
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); }

    const routeGroup = L.layerGroup();

    // Draw polyline
    const routeCoords: [number, number][] = [start, ...ordered.map((p) => p.latlng)];
    L.polyline(routeCoords, {
      color: "#16a34a", weight: 4, opacity: 0.8, dashArray: "10 6",
    }).addTo(routeGroup);

    // Start marker
    if (userPos) {
      L.marker(start, { icon: userIcon }).bindPopup("נקודת התחלה").addTo(routeGroup);
    }

    // Numbered task markers
    ordered.forEach((p, i) => {
      const marker = L.marker(p.latlng, { icon: numberedIcon(i + 1) });
      const popup = document.createElement("div");
      popup.dir = "rtl";
      popup.style.textAlign = "right";
      popup.style.minWidth = "160px";
      popup.innerHTML = `
        <p style="font-weight:800;font-size:13px;margin:0 0 2px;color:#16a34a">עצירה ${i + 1}</p>
        <p style="font-weight:700;font-size:14px;margin:0 0 4px">${p.task.branches?.networks?.name || ""}</p>
        <p style="font-size:12px;color:#666;margin:0 0 4px">${p.task.branches?.name || ""}</p>
        <p style="font-size:12px;color:#888;margin:0 0 8px">${p.task.work_type}</p>`;
      const btn = document.createElement("button");
      btn.textContent = "צפה במשימה";
      btn.style.cssText = "background:#16a34a;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%";
      btn.onclick = () => onSelectTask(p.task);
      popup.appendChild(btn);
      marker.bindPopup(popup);
      marker.addTo(routeGroup);
    });

    routeGroup.addTo(map);
    routeLayerRef.current = routeGroup;
    setRouteActive(true);

    // Calculate total distance
    let totalKm = 0;
    for (let i = 1; i < routeCoords.length; i++) {
      totalKm += haversine(routeCoords[i - 1], routeCoords[i]);
    }
    toast.success(`מסלול מותאם: ${ordered.length} עצירות, ~${Math.round(totalKm)} ק"מ`);

    map.fitBounds(L.latLngBounds(routeCoords), { padding: [40, 40] });
  }, [openTasks, userPos, onSelectTask]);

  const clearRoute = () => {
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    setRouteActive(false);
  };

  return (
    <div className="px-4 pb-24">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-base font-bold text-foreground">מפת משימות</h2>
        <div className="flex items-center gap-2">
          {routeActive ? (
            <Button variant="destructive" size="sm" onClick={clearRoute} className="h-8 gap-1">
              <X className="h-4 w-4" />
              <span className="text-xs">סגור מסלול</span>
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={showOptimizedRoute} className="h-8 gap-1" disabled={openTasks.length === 0}>
              <Route className="h-4 w-4" />
              <span className="text-xs">מסלול מותאם</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={locateMe} className="h-8 gap-1">
            <Locate className="h-4 w-4" />
            <span className="text-xs">מיקום שלי</span>
          </Button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden border shadow-card" style={{ height: "60vh" }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {openTasks.length} משימות על המפה
        {userPos ? " · מיקומך מסומן בכחול" : ""}
        {routeActive ? " · מסלול מותאם פעיל" : ""}
      </p>
    </div>
  );
}
