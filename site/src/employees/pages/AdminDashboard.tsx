import { useState, useMemo } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { StatCard } from "@/employees/components/StatCard";
import { Badge } from "@/employees/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { ClipboardList, AlertTriangle, CheckCircle2, Users, ChevronLeft, Bell, Siren, Timer } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getTrafficLight } from "@/employees/lib/trafficLight";
import { getImportantAlerts } from "@/employees/lib/importantAlerts";
import { useIsMobile } from "@/employees/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from "@/employees/components/ui/alert-dialog";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PersonalTasksBar } from "@/employees/components/PersonalTasksBar";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(45, 93%, 47%)",
  in_progress: "hsl(217, 91%, 60%)",
  completed: "hsl(142, 71%, 45%)",
  cancelled: "hsl(0, 84%, 60%)",
};

const STATUS_DONUT_COLORS: Record<string, string> = {
  completed: "hsl(217, 91%, 50%)",
  pending: "hsl(152, 69%, 35%)",
  in_progress: "hsl(36, 100%, 55%)",
  cancelled: "hsl(0, 84%, 55%)",
};

const CHART_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 67%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 80%, 55%)",
  "hsl(30, 90%, 50%)",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

export default function AdminDashboard() {
  const [acknowledgedDueSoon, setAcknowledgedDueSoon] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, branches(name, networks(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: teamLeaderCount = 0 } = useQuery({
    queryKey: ["team-leader-contractor-count"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("id").in("role", ["team_leader", "contractor"]);
      return data?.length || 0;
    },
  });

  const overdue = tasks.filter((t: any) => getTrafficLight(t.status, t.due_date, t.frequency).color === "red").length;
  const completed = tasks.filter((t: any) => t.status === "completed").length;

  const completedPct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const overduePct = tasks.length > 0 ? Math.round((overdue / tasks.length) * 100) : 0;

  const stats = [
    { title: "סה״כ משימות", value: tasks.length, icon: ClipboardList, subtitle: "בתיק", ringColor: "hsl(217, 91%, 60%)", ringPercent: 100 },
    { title: "באיחור", value: overdue, icon: AlertTriangle, subtitle: "דורש טיפול", ringColor: "hsl(0, 84%, 60%)", ringPercent: overduePct || 0 },
    { title: "הושלמו", value: completed, icon: CheckCircle2, subtitle: `${completedPct}%`, ringColor: "hsl(142, 71%, 45%)", ringPercent: completedPct },
    { title: "מבצעים", value: teamLeaderCount, icon: Users, subtitle: "פעילים", ringColor: "hsl(217, 70%, 50%)", ringPercent: 100 },
  ];

  const statusCounts: Record<string, number> = {};
  tasks.forEach((t: any) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    fill: STATUS_COLORS[status] || "hsl(var(--muted))",
  }));

  const statusDataDonut = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    fill: STATUS_DONUT_COLORS[status] || STATUS_COLORS[status] || "hsl(var(--muted))",
    status,
  }));
  const totalTasks = tasks.length;
  const todayFormatted = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  const networkCounts: Record<string, number> = {};
  tasks.forEach((t: any) => {
    const name = t.branches?.networks?.name || "לא משויך";
    networkCounts[name] = (networkCounts[name] || 0) + 1;
  });
  const networkData = Object.entries(networkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const executorCounts: Record<string, number> = {};
  tasks.forEach((t: any) => {
    const name = t.executor || "לא משויך";
    executorCounts[name] = (executorCounts[name] || 0) + 1;
  });
  const executorData = Object.entries(executorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // User overview: per-assignee stats
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
  });

  const { data: teamLeaderRoles = [] } = useQuery({
    queryKey: ["team-leader-and-contractor-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role").in("role", ["team_leader", "contractor"]);
      return data || [];
    },
  });

  const userStats = teamLeaderRoles.map((role: any) => {
    const profile = profiles.find((p: any) => p.user_id === role.user_id);
    const userTasks = tasks.filter((t: any) => t.assigned_to === role.user_id);
    const completedCount = userTasks.filter((t: any) => t.status === "completed").length;
    const overdueCount = userTasks.filter((t: any) => getTrafficLight(t.status, t.due_date, t.frequency).color === "red").length;
    const rate = userTasks.length > 0 ? Math.round((completedCount / userTasks.length) * 100) : 0;
    return {
      userId: role.user_id,
      name: profile?.full_name || "—",
      total: userTasks.length,
      completed: completedCount,
      overdue: overdueCount,
      rate,
    };
  }).filter((u: any) => u.total > 0).sort((a: any, b: any) => b.total - a.total);

  const recentTasks = tasks.slice(0, 5);

  const chartHeight = isMobile ? 200 : 220;
  const shouldAnimate =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;
  const yAxisFontSize = isMobile ? 9 : 11;
  const yAxisWidth = isMobile ? 60 : 110;
  const maxYAxisLabelLength = isMobile ? 6 : 14;
  const barMargin = isMobile
    ? { right: 65, left: 4, top: 8, bottom: 8 }
    : { right: 120, left: 16, top: 8, bottom: 8 };
  const truncateChartLabel = (value: string | number) => {
    const label = String(value ?? "");
    return label.length > maxYAxisLabelLength ? `${label.slice(0, maxYAxisLabelLength - 1)}…` : label;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Dashboard Header — Yarok 360 style */}
        <div className="bg-gradient-to-l from-card via-card to-accent/10 rounded-2xl shadow-md px-6 py-5 border-0">
          <div className="text-right mb-4">
            <h1 className="text-xl font-bold text-foreground">לוח בקרה</h1>
            <p className="text-muted-foreground text-xs mt-0.5">סקירה כללית של התפעול</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>
        </div>

        {/* Personal Tasks Bar */}
        <PersonalTasksBar />

        {/* Important Alerts */}
        {(() => {
          const alerts = getImportantAlerts(tasks as any);
          if (alerts.length === 0) return null;
          const dueSoonAlerts = alerts.filter(a => a.isDueSoon && !acknowledgedDueSoon.has(a.task.id));
          return (
            <>
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
                        <div key={alert.task.id} className="bg-white dark:bg-amber-900/50 rounded-lg p-3 border border-amber-300">
                          <p className="font-bold text-foreground">{alert.task.branches?.networks?.name} — {alert.task.branches?.name}</p>
                          <p className="text-sm text-muted-foreground">{alert.task.work_type} • {alert.task.executor || "לא משויך"}</p>
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

              <Card className="border-destructive/30 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <Bell className="h-5 w-5" />
                    הודעות חשובות ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {alerts.map((alert) => (
                    <div
                      key={alert.task.id}
                      onClick={() => navigate("/admin/tasks")}
                      className={`rounded-xl p-3 cursor-pointer transition-all active:scale-[0.99] flex items-start gap-3 ${
                        alert.isDueSoon
                          ? "bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-400 animate-pulse"
                          : alert.isOverdue
                          ? "bg-destructive/15 border-2 border-destructive/50 animate-pulse"
                          : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      {alert.isDueSoon ? (
                        <Timer className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      ) : alert.isOverdue ? (
                        <Siren className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${alert.isDueSoon ? "text-amber-700 dark:text-amber-300" : alert.isOverdue ? "text-destructive" : "text-foreground"}`}>
                          {alert.task.branches?.networks?.name} — {alert.task.branches?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{alert.task.work_type} • {alert.task.executor || "לא משויך"}</p>
                        <p className={`text-xs font-semibold mt-1 ${alert.isDueSoon ? "text-amber-600 dark:text-amber-400" : alert.isOverdue ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                          {alert.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          );
        })()}

        {/* Charts */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${shouldAnimate ? "animate-fade-in" : ""}`}>
          {/* Executor Pie — Yarok 360 style */}
          <Card className="rounded-xl shadow-md border-0 bg-card">
            <CardHeader className="pb-1 px-5 pt-5">
              <CardTitle className="text-base font-bold text-center">חלוקת משימות לפי מבצע</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-3">
              {executorData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height={chartHeight + 60}>
                      <PieChart>
                        <Pie
                          data={executorData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          outerRadius={isMobile ? 75 : 100}
                          paddingAngle={1}
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                          label={false}
                          labelLine={false}
                          isAnimationActive={shouldAnimate}
                          animationDuration={700}
                          animationEasing="ease-out"
                        >
                          {executorData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} stroke="hsl(var(--card))" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 13 }}
                          formatter={(value: number, name: string) => [`${value} משימות`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend on the side */}
                  <div className="shrink-0 space-y-2 pr-1">
                    <p className="text-xs font-bold text-foreground mb-2">מבצעים</p>
                    {executorData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div className="text-xs leading-tight">
                          <span className="font-semibold text-foreground">{entry.name}</span>
                          <br />
                          <span className="text-muted-foreground">({totalTasks > 0 ? Math.round((entry.count / totalTasks) * 100) : 0}% — {entry.count} משימות)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Footer summary */}
              <div className="border-t mt-2 pt-2 flex justify-between text-xs text-muted-foreground px-1">
                <span>סך משימות: {totalTasks}</span>
                <span>תאריך עדכון: {todayFormatted}</span>
              </div>
            </CardContent>
          </Card>

          {/* Network Pie Chart */}
          <Card className="rounded-xl shadow-md border-0 bg-card">
            <CardHeader className="pb-1 px-5 pt-5">
              <CardTitle className="text-base font-bold text-center">משימות לפי רשתות</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-3">
              {networkData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height={chartHeight + 60}>
                      <PieChart>
                        <Pie
                          data={networkData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          outerRadius={isMobile ? 75 : 100}
                          paddingAngle={1}
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                          label={false}
                          labelLine={false}
                          isAnimationActive={shouldAnimate}
                          animationDuration={700}
                          animationEasing="ease-out"
                        >
                          {networkData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} stroke="hsl(var(--card))" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 13 }}
                          formatter={(value: number, name: string) => [`${value} משימות`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend on the side */}
                  <div className="shrink-0 space-y-2 pr-1 max-h-[280px] overflow-y-auto">
                    <p className="text-xs font-bold text-foreground mb-2">רשתות</p>
                    {networkData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div className="text-xs leading-tight">
                          <span className="font-semibold text-foreground">{entry.name}</span>
                          <br />
                          <span className="text-muted-foreground">({totalTasks > 0 ? Math.round((entry.count / totalTasks) * 100) : 0}% — {entry.count} משימות)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Footer summary */}
              <div className="border-t mt-2 pt-2 flex justify-between text-xs text-muted-foreground px-1">
                <span>סך משימות: {totalTasks}</span>
                <span>תאריך עדכון: {todayFormatted}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status Donut — inspired by Yarok 360 style */}
          <Card className="rounded-xl shadow-md border-0 bg-card">
            <CardHeader className="pb-0 px-5 pt-5">
              <CardTitle className="text-base font-bold text-center">משימות לפי סטטוס</CardTitle>
              
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-3">
              {statusDataDonut.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height={chartHeight + 40}>
                      <PieChart>
                        <Pie
                          data={statusDataDonut}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          innerRadius={isMobile ? 38 : 52}
                          outerRadius={isMobile ? 68 : 90}
                          paddingAngle={2}
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                          label={false}
                          labelLine={false}
                          isAnimationActive={shouldAnimate}
                          animationDuration={700}
                          animationEasing="ease-out"
                        >
                          {statusDataDonut.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} strokeWidth={2} stroke="hsl(var(--card))" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 13 }}
                          formatter={(value: number, name: string) => [`${value} משימות`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend on the side */}
                  <div className="shrink-0 space-y-2 pr-1">
                    <p className="text-xs font-bold text-foreground mb-2">סטטוסים</p>
                    {statusDataDonut.map((entry) => (
                      <div key={entry.status} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
                        <div className="text-xs leading-tight">
                          <span className="font-semibold text-foreground">{entry.name}</span>
                          <br />
                          <span className="text-muted-foreground">({totalTasks > 0 ? Math.round((entry.value / totalTasks) * 100) : 0}% — {entry.value} משימות)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Footer summary */}
              <div className="border-t mt-2 pt-2 flex justify-between text-xs text-muted-foreground px-1">
                <span>סך משימות: {totalTasks}</span>
                <span>תאריך עדכון: {todayFormatted}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Overview Cards — Yarok 360 style */}
        {userStats.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground text-right mb-4">סקירת מבצעים</h2>
            <div className="bg-gradient-to-l from-card via-card to-accent/10 rounded-2xl shadow-md p-4">
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ direction: "rtl" }}>
                {userStats.map((u: any, idx: number) => {
                  const avatarColors = [
                    "hsl(0, 70%, 50%)",
                    "hsl(200, 20%, 55%)",
                    "hsl(142, 50%, 35%)",
                    "hsl(30, 80%, 50%)",
                    "hsl(260, 50%, 45%)",
                    "hsl(180, 50%, 40%)",
                  ];
                  const avatarColor = avatarColors[idx % avatarColors.length];
                  const ringSize = 48;
                  const ringStroke = 4;
                  const ringRadius = (ringSize - ringStroke) / 2;
                  const ringCircumference = 2 * Math.PI * ringRadius;
                  const ringOffset = ringCircumference - (u.rate / 100) * ringCircumference;

                  return (
                    <Card
                      key={u.userId}
                      className="min-w-[140px] max-w-[160px] flex-shrink-0 rounded-xl shadow-sm border-0 bg-card cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/admin/user-tasks/${u.userId}`)}
                    >
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        {/* Header: name + chevron */}
                        <div className="flex items-center justify-between w-full">
                          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-bold text-sm text-foreground">{u.name}</h3>
                        </div>

                        {/* Avatar + Ring */}
                        <div className="flex items-center gap-2">
                          {/* Ring indicator */}
                          <div className="relative" style={{ width: ringSize, height: ringSize }}>
                            <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth={ringStroke} />
                              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="hsl(142, 71%, 45%)" strokeWidth={ringStroke} strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-foreground">{u.rate}%</span>
                            </div>
                          </div>

                          {/* Avatar silhouette */}
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${avatarColor}20` }}>
                            <Users className="h-6 w-6" style={{ color: avatarColor }} />
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-1 text-center w-full border-t pt-2">
                          <div>
                            <p className={`text-sm font-bold ${u.overdue > 0 ? "text-destructive" : "text-foreground"}`}>{u.overdue}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">איחור</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">{u.rate}%</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">ביצוע</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{u.total}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">משימות</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">משימות אחרונות</h2>
          {recentTasks.length === 0 ? (
            <div className="bg-card rounded-lg border shadow-card p-8 text-center">
              <p className="text-muted-foreground">אין משימות עדיין. ייבא נתונים או צור משימה חדשה.</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border shadow-card divide-y">
              {recentTasks.map((t: any) => {
                const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
                return (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{t.branches?.networks?.name} — {t.branches?.name}</p>
                      <p className="text-sm text-muted-foreground">{t.work_type}</p>
                    </div>
                    <Badge className={traffic.className}>{traffic.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
