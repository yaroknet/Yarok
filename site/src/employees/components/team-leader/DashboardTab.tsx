import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, ListTodo, Mail, Bell, Siren, Timer, TrendingUp, Sparkles, RefreshCw, Zap, MapPin, ClipboardList } from "lucide-react";
import { TeamTask, getUrgencyScore } from "@/employees/hooks/useTeamTasks";
import { getImportantAlerts } from "@/employees/lib/importantAlerts";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from "@/employees/components/ui/alert-dialog";
import { Badge } from "@/employees/components/ui/badge";
import { Button } from "@/employees/components/ui/button";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { useAuth } from "@/employees/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { ServiceStartProofForm } from "@/employees/components/ServiceStartProofForm";
import type { TabId } from "./BottomNav";

interface DashboardTabProps {
  tasks: TeamTask[];
  onNavigate: (tab: TabId, filter?: string) => void;
  unreadMessages?: number;
  userName?: string;
}

const frequencyLabels: Record<string, string> = {
  one_time: "חד פעמי",
  monthly: "חודשי",
  quarterly: "רבעוני",
  half_yearly: "חצי שנתי",
  yearly: "שנתי",
};

const frequencyColors: Record<string, string> = {
  one_time: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  monthly: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  quarterly: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  half_yearly: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  yearly: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

export function DashboardTab({ tasks, onNavigate, unreadMessages = 0, userName }: DashboardTabProps) {
  const { user } = useAuth();
  const [acknowledgedDueSoon, setAcknowledgedDueSoon] = useState<Set<string>>(new Set());
  const [proofServiceId, setProofServiceId] = useState<string | null>(null);
  const [proofServiceName, setProofServiceName] = useState("");
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const urgent = open.filter((t) => getUrgencyScore(t) >= 2);
  const completed = tasks.filter((t) => t.status === "completed");
  const alerts = getImportantAlerts(tasks as any);
  const dueSoonAlerts = alerts.filter(a => a.isDueSoon && !acknowledgedDueSoon.has(a.task.id));

  // Fetch pending service start proofs for this user
  const { data: pendingServices = [] } = useQuery({
    queryKey: ["pending-service-proofs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get services assigned to this user with action_type = start
      const { data: services } = await supabase
        .from("services")
        .select("id, network_name, branch_name, created_at")
        .eq("action_type", "start")
        .eq("assigned_to", user.id)
        .eq("status", "active");
      if (!services || services.length === 0) return [];

      // Check which already have proofs
      const { data: proofs } = await supabase
        .from("service_start_proofs")
        .select("service_id")
        .in("service_id", services.map((s: any) => s.id));

      const proofsSet = new Set((proofs || []).map((p: any) => p.service_id));
      return services.filter((s: any) => !proofsSet.has(s.id));
    },
    enabled: !!user,
  });

  // Recent tasks - sorted by created_at descending, take 5
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Split by type
  const oneTimeTasks = open.filter(t => t.frequency === "one_time");
  const recurringTasks = open.filter(t => t.frequency !== "one_time");

  // Group recurring by frequency
  const recurringByFreq: Record<string, TeamTask[]> = {};
  for (const t of recurringTasks) {
    if (!recurringByFreq[t.frequency]) recurringByFreq[t.frequency] = [];
    recurringByFreq[t.frequency].push(t);
  }

  return (
    <div className="px-4 pb-4 space-y-4 pt-2">
      {/* Welcome greeting - mobile only */}
      {userName && (
        <div className="md:hidden">
          <p className="text-muted-foreground text-sm">שלום, <span className="font-semibold text-foreground">{userName}</span> 👋</p>
        </div>
      )}

      {/* Unread messages banner */}
      {unreadMessages > 0 && (
        <button
          onClick={() => onNavigate("messages")}
          className="w-full bg-destructive/10 border border-destructive/20 rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="bg-destructive rounded-xl p-2.5 shadow-sm">
            <Mail className="h-5 w-5 text-destructive-foreground" />
          </div>
          <div className="text-right flex-1">
            <p className="text-sm font-bold text-destructive">יש לך {unreadMessages} הודעות חדשות</p>
            <p className="text-xs text-muted-foreground">לחץ לצפייה</p>
          </div>
        </button>
      )}

      {/* Pending service start proofs */}
      {pendingServices.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-primary" />
            טופס תחילת שירות למילוי ({pendingServices.length})
          </p>
          {pendingServices.map((s: any) => (
            <button
              key={s.id}
              onClick={() => {
                setProofServiceId(s.id);
                setProofServiceName(`${s.network_name} — ${s.branch_name}`);
              }}
              className="w-full bg-primary/10 border border-primary/20 rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="bg-primary rounded-xl p-2.5 shadow-sm">
                <ClipboardList className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="text-right flex-1">
                <p className="text-sm font-bold text-foreground">{s.network_name} — {s.branch_name}</p>
                <p className="text-xs text-muted-foreground">טופס תחילת שירות למילוי על ידי מנהל אזור</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Summary strip */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">סקירת מבצעים</span>
        </div>
        <div className="flex items-center justify-around">
          <div className="text-center">
            <span className="text-3xl font-extrabold text-foreground">{tasks.length}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">סה״כ משימות</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <span className="text-3xl font-extrabold text-emerald-600">{completed.length}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">הושלמו</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <span className="text-3xl font-extrabold text-amber-600">{open.length}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">פתוחות</p>
          </div>
        </div>
      </div>

      {/* Action cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Urgent */}
        <button
          onClick={() => onNavigate("tasks", "urgent")}
          className="bg-card border border-border rounded-2xl p-4 text-right transition-all active:scale-95 shadow-sm hover:shadow-md relative overflow-hidden animate-fade-in"
          style={{ animationDelay: "100ms", animationFillMode: "both" }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-bl-[60px]" />
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-3xl font-extrabold text-red-600 dark:text-red-400">{urgent.length}</span>
          </div>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">משימות דחופות</p>
          <p className="text-[11px] text-muted-foreground">דורשות טיפול מיידי</p>
        </button>

        {/* Pending */}
        <button
          onClick={() => onNavigate("tasks", "pending")}
          className="bg-card border border-border rounded-2xl p-4 text-right transition-all active:scale-95 shadow-sm hover:shadow-md relative overflow-hidden animate-fade-in"
          style={{ animationDelay: "200ms", animationFillMode: "both" }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-[60px]" />
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{open.length}</span>
          </div>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">ממתינות</p>
          <p className="text-[11px] text-muted-foreground">בהמתנה לביצוע</p>
        </button>

        {/* Completed */}
        <button
          onClick={() => onNavigate("history")}
          className="bg-card border border-border rounded-2xl p-4 text-right transition-all active:scale-95 shadow-sm hover:shadow-md relative overflow-hidden animate-fade-in"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-[60px]" />
          <div className="flex items-center justify-between mb-2">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{completed.length}</span>
          </div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">שהושלמו</p>
          <p className="text-[11px] text-muted-foreground">משימות שבוצעו</p>
        </button>

        {/* Total */}
        <button
          onClick={() => onNavigate("tasks")}
          className="bg-card border border-border rounded-2xl p-4 text-right transition-all active:scale-95 shadow-sm hover:shadow-md relative overflow-hidden animate-fade-in"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-bl-[60px]" />
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl">
              <ListTodo className="h-5 w-5 text-purple-500" />
            </div>
            <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">{tasks.length}</span>
          </div>
          <p className="text-sm font-bold text-purple-600 dark:text-purple-400">סה״כ</p>
          <p className="text-[11px] text-muted-foreground">כל המשימות</p>
        </button>
      </div>

      {/* Task type breakdown */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 animate-fade-in" style={{ animationDelay: "450ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">חלוקה לפי סוג משימה</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* One-time */}
          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 text-right">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300">חד פעמי</span>
            </div>
            <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{oneTimeTasks.length}</span>
            <p className="text-[10px] text-muted-foreground">משימות פתוחות</p>
          </div>

          {/* Recurring grouped */}
          {Object.entries(recurringByFreq).map(([freq, freqTasks]) => (
            <div
              key={freq}
              className={`border rounded-xl p-3 text-right ${
                freq === "monthly" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" :
                freq === "quarterly" ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800" :
                freq === "half_yearly" ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" :
                "bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className={`h-4 w-4 ${
                  freq === "monthly" ? "text-blue-500" :
                  freq === "quarterly" ? "text-teal-500" :
                  freq === "half_yearly" ? "text-orange-500" :
                  "text-pink-500"
                }`} />
                <span className={`text-xs font-bold ${
                  freq === "monthly" ? "text-blue-700 dark:text-blue-300" :
                  freq === "quarterly" ? "text-teal-700 dark:text-teal-300" :
                  freq === "half_yearly" ? "text-orange-700 dark:text-orange-300" :
                  "text-pink-700 dark:text-pink-300"
                }`}>{frequencyLabels[freq] || freq}</span>
              </div>
              <span className={`text-2xl font-extrabold ${
                freq === "monthly" ? "text-blue-600 dark:text-blue-400" :
                freq === "quarterly" ? "text-teal-600 dark:text-teal-400" :
                freq === "half_yearly" ? "text-orange-600 dark:text-orange-400" :
                "text-pink-600 dark:text-pink-400"
              }`}>{freqTasks.length}</span>
              <p className="text-[10px] text-muted-foreground">משימות פתוחות</p>
            </div>
          ))}

          {/* Show recurring total if empty */}
          {Object.keys(recurringByFreq).length === 0 && (
            <div className="bg-muted/30 border border-border rounded-xl p-3 text-right">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">חוזרות</span>
              </div>
              <span className="text-2xl font-extrabold text-muted-foreground">0</span>
              <p className="text-[10px] text-muted-foreground">משימות פתוחות</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks */}
      {recentTasks.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">משימות אחרונות שנכנסו</span>
            </div>
            <button
              onClick={() => onNavigate("tasks")}
              className="text-xs text-primary font-medium hover:underline"
            >
              הצג הכל
            </button>
          </div>
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onNavigate("tasks")}
                className="bg-muted/30 rounded-xl p-3 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {task.branches?.networks?.name} — {task.branches?.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{task.work_type}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${frequencyColors[task.frequency] || "bg-muted text-muted-foreground"}`}>
                      {frequencyLabels[task.frequency] || task.frequency}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(task.created_at), "dd/MM", { locale: he })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due-soon push notification dialog */}
      {dueSoonAlerts.length > 0 && (
        <AlertDialog open={true} onOpenChange={() => {}}>
          <AlertDialogContent dir="rtl" className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Timer className="h-6 w-6 animate-bounce" />
                ⏰ תזכורת — משימות מתקרבות!
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {dueSoonAlerts.map((alert) => (
                <div key={alert.task.id} className="bg-white dark:bg-amber-900/50 rounded-xl p-3 border border-amber-300">
                  <p className="font-bold text-foreground">{alert.task.branches?.networks?.name} — {alert.task.branches?.name}</p>
                  <p className="text-sm text-muted-foreground">{alert.task.work_type}</p>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mt-1">{alert.reason}</p>
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setAcknowledgedDueSoon(prev => {
                    const next = new Set(prev);
                    dueSoonAlerts.forEach(a => next.add(a.task.id));
                    return next;
                  });
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white w-full text-lg py-3"
              >
                ✓ אישור — קראתי
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Important Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
            <Bell className="h-4 w-4" />
            הודעות חשובות ({alerts.length})
          </h3>
          {alerts.map((alert) => (
            <div
              key={alert.task.id}
              onClick={() => onNavigate("tasks")}
              className={`rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.98] flex items-start gap-3 ${
                alert.isDueSoon
                  ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"
                  : alert.isOverdue
                  ? "bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800"
                  : "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {alert.isDueSoon ? (
                <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl shrink-0">
                  <Timer className="h-4 w-4 text-amber-600" />
                </div>
              ) : alert.isOverdue ? (
                <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-xl shrink-0">
                  <Siren className="h-4 w-4 text-destructive" />
                </div>
              ) : (
                <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {alert.task.branches?.networks?.name} — {alert.task.branches?.name}
                </p>
                <p className="text-xs text-muted-foreground">{alert.task.work_type}</p>
                <p className={`text-xs font-semibold mt-1 ${alert.isDueSoon ? "text-amber-600 dark:text-amber-400" : alert.isOverdue ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                  {alert.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Start Proof Form */}
      {proofServiceId && (
        <ServiceStartProofForm
          open={!!proofServiceId}
          onClose={() => setProofServiceId(null)}
          serviceId={proofServiceId}
          serviceName={proofServiceName}
        />
      )}
    </div>
  );
}