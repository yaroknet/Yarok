import { useState, lazy, Suspense } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/employees/components/ui/button";
import { useAuth } from "@/employees/contexts/AuthContext";
import { useTeamTasks, TeamTask } from "@/employees/hooks/useTeamTasks";
import { BottomNav, TabId } from "@/employees/components/team-leader/BottomNav";
import { DashboardTab } from "@/employees/components/team-leader/DashboardTab";
import { TasksTab } from "@/employees/components/team-leader/TasksTab";
import { CalendarTab } from "@/employees/components/team-leader/CalendarTab";
import { MessagesTab } from "@/employees/components/team-leader/MessagesTab";
import { HistoryTab } from "@/employees/components/team-leader/HistoryTab";
import { TaskWorkflowModal } from "@/employees/components/team-leader/TaskWorkflowModal";
import { ContractorWorkersTab } from "@/employees/components/team-leader/ContractorWorkersTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";

const MapTab = lazy(() => import("@/employees/components/team-leader/MapTab").then((m) => ({ default: m.MapTab })));

export default function TeamLeaderView() {
  const { signOut, user, roles } = useAuth();
  const { data: tasks = [], isLoading } = useTeamTasks();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [taskFilter, setTaskFilter] = useState<string | undefined>();
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);

  const isContractor = roles.includes("contractor");
  const isContractorWorker = roles.includes("contractor_worker");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("internal_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const handleNavigate = (tab: TabId, filter?: string) => {
    setActiveTab(tab);
    setTaskFilter(filter);
  };

  const tabTitles: Record<TabId, string> = {
    dashboard: "לוח בקרה",
    tasks: taskFilter === "urgent" ? "משימות דחופות" : "משימות",
    calendar: "לוח שנה",
    messages: "הודעות",
    history: "ארכיון",
    map: "מפת משימות",
    workers: "עובדים",
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-muted/30 pb-20" dir="rtl">
      {/* ===== TOP HEADER ===== */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between px-6 h-14 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Y</span>
            </div>
            <span className="font-bold text-foreground">Yarok 360</span>
            <span className="text-xs text-muted-foreground border-r border-border pr-3 mr-1">
              {isContractorWorker ? "עובד קבלן" : isContractor ? "קבלן" : "ממשק שטח"}
            </span>
          </div>
          {/* Desktop nav tabs */}
          <nav className="flex items-center gap-1">
            {(["dashboard", "tasks", ...(isContractor ? ["workers" as TabId] : []), "calendar", "map", "messages", "history"] as TabId[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab !== "tasks") setTaskFilter(undefined); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tabTitles[tab]}
              </button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            יציאה
          </Button>
        </div>

        {/* Mobile header */}
        <div className="md:hidden px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground font-bold text-lg">Y</span>
              </div>
              <div>
                <h1 className="font-bold text-foreground text-base leading-tight">Yarok 360</h1>
                <p className="text-[11px] text-muted-foreground">{isContractorWorker ? "עובד קבלן" : isContractor ? "קבלן" : "ממשק שטח"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {firstName && (
                <span className="text-sm font-medium text-muted-foreground hidden xs:inline">
                  שלום, {firstName}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9"
                onClick={() => signOut()}
              >
                <LogOut className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile page title */}
        <div className="md:hidden px-4 pb-3">
          <h2 className="text-xl font-extrabold text-foreground">{tabTitles[activeTab]}</h2>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardTab tasks={tasks} onNavigate={handleNavigate} unreadMessages={unreadCount} userName={firstName} />
            )}
            {activeTab === "tasks" && (
              <TasksTab tasks={tasks} filter={taskFilter} onSelectTask={setSelectedTask} />
            )}
            {activeTab === "calendar" && (
              <CalendarTab tasks={tasks} onSelectTask={setSelectedTask} />
            )}
            {activeTab === "messages" && (
              <div className="px-4 space-y-4 pt-2">
                <p className="text-muted-foreground text-sm">שיחות פנימיות עם הנהלת המערכת</p>
                <MessagesTab variant="desktop" />
              </div>
            )}
            {activeTab === "history" && <HistoryTab tasks={tasks} />}
            {activeTab === "workers" && isContractor && (
              <ContractorWorkersTab tasks={tasks} />
            )}
            {activeTab === "map" && (
              <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <MapTab tasks={tasks} onSelectTask={setSelectedTask} />
              </Suspense>
            )}
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav
          active={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            if (tab !== "tasks") setTaskFilter(undefined);
          }}
          unreadMessages={unreadCount}
          showWorkersTab={isContractor}
        />
      </div>

      <TaskWorkflowModal
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
