import { LayoutDashboard, ListTodo, MessageSquare, Archive, Map, CalendarDays, Users } from "lucide-react";

export type TabId = "dashboard" | "tasks" | "messages" | "history" | "map" | "calendar" | "workers";

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  unreadMessages?: number;
  showWorkersTab?: boolean;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { id: "tasks", label: "משימות", icon: ListTodo },
  { id: "calendar", label: "לוח שנה", icon: CalendarDays },
  { id: "map", label: "מפה", icon: Map },
  { id: "messages", label: "הודעות", icon: MessageSquare },
  { id: "history", label: "ארכיון", icon: Archive },
];

export function BottomNav({ active, onChange, unreadMessages = 0, showWorkersTab = false }: BottomNavProps) {
  const visibleTabs = showWorkersTab
    ? [...tabs.slice(0, 2), { id: "workers" as TabId, label: "עובדים", icon: Users }, ...tabs.slice(2)]
    : tabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all relative ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-colors ${isActive ? "bg-primary/10" : ""}`}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.id === "messages" && unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 shadow-sm">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? "font-bold" : "font-medium"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
