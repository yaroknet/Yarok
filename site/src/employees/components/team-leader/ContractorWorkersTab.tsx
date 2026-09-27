import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { TeamTask } from "@/employees/hooks/useTeamTasks";
import { Button } from "@/employees/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Badge } from "@/employees/components/ui/badge";
import { Users, UserPlus, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ContractorWorkersTabProps {
  tasks: TeamTask[];
}

export function ContractorWorkersTab({ tasks }: ContractorWorkersTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Fetch workers linked to this contractor
  const { data: workers = [] } = useQuery({
    queryKey: ["my-workers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("contractor_workers")
        .select("worker_id")
        .eq("contractor_id", user.id);
      if (!links || links.length === 0) return [];
      const workerIds = links.map((l: any) => l.worker_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", workerIds);
      return profiles || [];
    },
    enabled: !!user,
  });

  // Assign task to worker
  const assignMutation = useMutation({
    mutationFn: async ({ taskId, workerId }: { taskId: string; workerId: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: workerId })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("המשימה הוקצתה בהצלחה");
    },
    onError: () => toast.error("שגיאה בהקצאת המשימה"),
  });

  // Reclaim task back to contractor
  const reclaimMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: user.id })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("המשימה הוחזרה אליך");
    },
    onError: () => toast.error("שגיאה"),
  });

  const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

  if (workers.length === 0) {
    return (
      <div className="px-4 pb-24 pt-2">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">אין עובדים משויכים</h3>
            <p className="text-sm text-muted-foreground">
              פנה למנהל המערכת כדי להוסיף עובדי קבלן ולשייך אותם אליך
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 space-y-4 pt-2">
      {/* Workers list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            העובדים שלי ({workers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workers.map((w: any) => (
            <div key={w.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <span className="font-medium text-sm">{w.full_name || "—"}</span>
                {w.phone && <span className="text-xs text-muted-foreground mr-2">{w.phone}</span>}
              </div>
              <Badge variant="secondary" className="text-xs">עובד קבלן</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Task assignment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            הקצאת משימות לעובדים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">אין משימות פתוחות</p>
          ) : (
            openTasks.map((task) => (
              <div key={task.id} className="border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{task.branches?.networks?.name}</h4>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {task.branches?.name}
                    </div>
                    <span className="text-xs text-muted-foreground">{task.work_type}</span>
                  </div>
                  {task.assigned_to !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => reclaimMutation.mutate(task.id)}
                    >
                      החזר אלי
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={task.assigned_to === user?.id ? "me" : (task.assigned_to || "me")}
                    onValueChange={(v) => {
                      if (v === "me") {
                        reclaimMutation.mutate(task.id);
                      } else {
                        assignMutation.mutate({ taskId: task.id, workerId: v });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="שייך לעובד..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">שלי (לא משויך)</SelectItem>
                      {workers.map((w: any) => (
                        <SelectItem key={w.user_id} value={w.user_id}>
                          {w.full_name || w.phone || "עובד"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
