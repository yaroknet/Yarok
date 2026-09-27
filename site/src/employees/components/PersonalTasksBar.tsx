import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Badge } from "@/employees/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, ListTodo, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ALLOWED_USER_IDS = [
  "d0175b71-1a13-4a93-93b2-d984738cf346",
  "78e34772-303e-469e-9771-a38aa93ddc2c",
  "5a5d0194-6ce1-448b-a1a7-da4466fcdffc",
];

interface UserTaskSummary {
  userId: string;
  name: string;
  urgent: number;
  inProgress: number;
  notDone: number;
  done: number;
  total: number;
  urgentTitles: string[];
}

export function PersonalTasksBar() {
  const navigate = useNavigate();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["personal-tasks-bar"],
    queryFn: async () => {
      const [{ data: tasks }, { data: profiles }] = await Promise.all([
        supabase
          .from("personal_tasks")
          .select("assigned_to, title, status, urgency, is_done")
          .in("assigned_to", ALLOWED_USER_IDS),
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ALLOWED_USER_IDS),
      ]);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameMap[p.user_id] = p.full_name || "—";
      });

      const grouped: Record<string, any[]> = {};
      ALLOWED_USER_IDS.forEach((id) => (grouped[id] = []));
      (tasks || []).forEach((t: any) => {
        if (grouped[t.assigned_to]) grouped[t.assigned_to].push(t);
      });

      return ALLOWED_USER_IDS.map((userId): UserTaskSummary => {
        const userTasks = grouped[userId] || [];
        const urgent = userTasks.filter(
          (t) => (t.urgency === "urgent" || t.urgency === "high") && !t.is_done
        );
        const inProgress = userTasks.filter((t) => t.status === "in_progress" && !t.is_done);
        const notDone = userTasks.filter((t) => !t.is_done);
        const done = userTasks.filter((t) => t.is_done);

        return {
          userId,
          name: nameMap[userId] || "—",
          urgent: urgent.length,
          inProgress: inProgress.length,
          notDone: notDone.length,
          done: done.length,
          total: userTasks.length,
          urgentTitles: urgent.slice(0, 3).map((t) => t.title),
        };
      });
    },
    refetchInterval: 60000,
  });

  if (isLoading || summaries.length === 0) return null;

  const totalUrgent = summaries.reduce((s, u) => s + u.urgent, 0);

  return (
    <div
      className="bg-gradient-to-l from-card via-card to-accent/10 rounded-2xl shadow-md px-4 py-3 border-0 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate("/admin/personal-tasks")}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">פתח לוח אישי</span>
        </div>
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">לוח משימות אישי</h3>
          {totalUrgent > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 animate-pulse">
              {totalUrgent} דחופות!
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {summaries.map((u) => (
          <div
            key={u.userId}
            className={`rounded-xl p-2.5 border transition-colors ${
              u.urgent > 0
                ? "bg-destructive/5 border-destructive/20"
                : "bg-muted/30 border-border/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                {u.urgent > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                {u.notDone === 0 && u.total > 0 && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </div>
              <p className="text-xs font-bold text-foreground">{u.name}</p>
            </div>

            <div className="flex items-center justify-end gap-3 text-[10px]">
              {u.urgent > 0 && (
                <span className="text-destructive font-semibold">{u.urgent} דחוף</span>
              )}
              {u.inProgress > 0 && (
                <span className="text-blue-600 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {u.inProgress} בטיפול
                </span>
              )}
              <span className="text-muted-foreground">
                {u.notDone}/{u.total}
              </span>
            </div>

            {u.urgentTitles.length > 0 && (
              <div className="mt-1.5 border-t border-destructive/10 pt-1">
                {u.urgentTitles.map((title, i) => (
                  <p key={i} className="text-[10px] text-destructive/80 truncate leading-relaxed">
                    🔴 {title}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
