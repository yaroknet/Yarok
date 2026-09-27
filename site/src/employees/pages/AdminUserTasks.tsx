import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Badge } from "@/employees/components/ui/badge";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { ArrowRight, MapPin, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getTrafficLight } from "@/employees/lib/trafficLight";
import { EditTaskDialog } from "@/employees/components/EditTaskDialog";
import { useIsMobile } from "@/employees/hooks/use-mobile";
import { differenceInDays, parseISO } from "date-fns";

const frequencyLabels: Record<string, string> = {
  one_time: "חד פעמי",
  monthly: "חודשי",
  quarterly: "רבעוני",
};

const statusLabels: Record<string, string> = {
  pending: "ממתין",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

export default function AdminUserTasks() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [editTask, setEditTask] = useState<any>(null);
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterFrequency, setFilterFrequency] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOverdue, setFilterOverdue] = useState("all");

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["user-tasks", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, branches(name, city, networks(name))")
        .eq("assigned_to", userId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const getOverdueDays = (t: any) => {
    if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return 0;
    const days = differenceInDays(new Date(), parseISO(t.due_date));
    return days > 0 ? days : 0;
  };

  const networks = [...new Set(tasks.map((t: any) => t.branches?.networks?.name).filter(Boolean))];
  const frequencies = [...new Set(tasks.map((t: any) => t.frequency).filter(Boolean))];
  const statuses = [...new Set(tasks.map((t: any) => t.status).filter(Boolean))];

  const filtered = tasks.filter((t: any) => {
    if (filterNetwork !== "all" && (t.branches?.networks?.name || "") !== filterNetwork) return false;
    if (filterFrequency !== "all" && t.frequency !== filterFrequency) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterOverdue === "overdue" && getOverdueDays(t) === 0) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">משימות — {profile?.full_name || "טוען..."}</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} משימות</p>
          </div>
        </div>

        {editTask && <EditTaskDialog task={editTask} open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)} />}

        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterNetwork} onValueChange={setFilterNetwork}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="רשת" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הרשתות</SelectItem>
              {networks.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterFrequency} onValueChange={setFilterFrequency}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="תדירות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל התדירויות</SelectItem>
              {frequencies.map((f) => <SelectItem key={f} value={f}>{frequencyLabels[f] || f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterOverdue} onValueChange={setFilterOverdue}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="איחור" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="overdue">באיחור בלבד</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">טוען...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">אין משימות</div>
            ) : filtered.map((t: any) => {
              const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
              const overdueDays = getOverdueDays(t);
              return (
                <Card key={t.id} className="shadow-card cursor-pointer hover:shadow-elevated transition-shadow" onClick={() => setEditTask(t)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{t.branches?.networks?.name || "—"}</h3>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{t.branches?.name || "—"}</span>
                        </div>
                      </div>
                      <Badge className={traffic.className}>{traffic.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground mb-1">{t.work_type}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                      <span>תדירות: {frequencyLabels[t.frequency] || t.frequency}</span>
                      {t.due_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t.due_date}</span>}
                    </div>
                    {overdueDays > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-destructive text-xs font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>באיחור {overdueDays} ימים</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-lg border shadow-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>רשת</TableHead>
                  <TableHead>סניף</TableHead>
                  <TableHead>סוג עבודה</TableHead>
                  <TableHead>תדירות</TableHead>
                  <TableHead>תאריך יעד</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">טוען...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">אין משימות</TableCell>
                  </TableRow>
                ) : filtered.map((t: any) => {
                  const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
                  const overdueDays = getOverdueDays(t);
                  return (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditTask(t)}>
                      <TableCell className="font-medium">{t.branches?.networks?.name || "—"}</TableCell>
                      <TableCell>{t.branches?.name || "—"}</TableCell>
                      <TableCell>{t.work_type}</TableCell>
                      <TableCell>{frequencyLabels[t.frequency] || t.frequency}</TableCell>
                      <TableCell>
                        {t.due_date || "—"}
                        {overdueDays > 0 && <span className="text-destructive text-xs mr-1">({overdueDays} ימים)</span>}
                      </TableCell>
                      <TableCell><Badge className={traffic.className}>{traffic.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
