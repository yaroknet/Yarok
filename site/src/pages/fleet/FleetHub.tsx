import { FleetSettings } from "@/components/fleet/FleetSettings";
import { FleetDashboard } from "@/components/fleet/FleetDashboard";
import { VehiclesScreen } from "@/components/fleet/VehiclesScreen";
import { DriversScreen } from "@/components/fleet/DriversScreen";
import { MaintenanceScreen, IncidentsScreen, FinesScreen, DocumentsScreen, AlertsScreen } from "@/components/fleet/GenericListScreen";
import { KmMonthlyManagement } from "@/components/fleet/KmMonthlyManagement";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Car,
  Users,
  Wrench,
  AlertTriangle,
  Receipt,
  FileText,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react";

type SectionKey =
  | "dashboard"
  | "vehicles"
  | "drivers"
  | "maintenance"
  | "incidents"
  | "fines"
  | "documents"
  | "km-monthly"
  | "alerts"
  | "settings";

const SECTIONS: { key: SectionKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "דשבורד צי", icon: LayoutDashboard },
  { key: "vehicles", label: "רכבים", icon: Car },
  { key: "drivers", label: "נהגים", icon: Users },
  { key: "maintenance", label: "טיפולים ואחזקה", icon: Wrench },
  { key: "incidents", label: "תאונות", icon: AlertTriangle },
  { key: "fines", label: "קנסות", icon: Receipt },
  { key: "documents", label: "מסמכים", icon: FileText },
  { key: "km-monthly", label: "דיווחי ק\"מ חודשיים", icon: Bell },
  { key: "alerts", label: "התראות", icon: Bell },
  { key: "settings", label: "הגדרות", icon: SettingsIcon },
];

export default function FleetHub() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const active: SectionKey = (SECTIONS.find(s => s.key === section)?.key ?? "dashboard");

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">ניהול צי רכב</h1>
          <p className="text-sm text-muted-foreground mt-1">תיק רכב חכם — ניהול ממוקד ומהיר</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:sticky md:top-4 md:self-start">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = s.key === active;
            return (
              <Button
                key={s.key}
                variant={isActive ? "default" : "ghost"}
                className="justify-start gap-2 whitespace-nowrap"
                onClick={() => navigate(`/fleet/${s.key}`)}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </Button>
            );
          })}
        </nav>

        <main>
          {active === "dashboard" && <FleetDashboard />}
          {active === "vehicles" && <VehiclesScreen />}
          {active === "drivers" && <DriversScreen />}
          {active === "maintenance" && <MaintenanceScreen />}
          {active === "incidents" && <IncidentsScreen />}
          {active === "fines" && <FinesScreen />}
          {active === "documents" && <DocumentsScreen />}
          {active === "km-monthly" && <KmMonthlyManagement />}
          {active === "alerts" && <AlertsScreen />}
          {active === "settings" && <FleetSettings />}
        </main>
      </div>
    </div>
  );
}
