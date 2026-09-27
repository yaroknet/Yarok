import { useState, useMemo } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Badge } from "@/employees/components/ui/badge";
import { Button } from "@/employees/components/ui/button";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import { ScrollArea } from "@/employees/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, MapPin, Clock, AlertCircle, Filter, Eye } from "lucide-react";
import { FieldReportViewer } from "@/employees/components/FieldReportViewer";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, getDay, parseISO, isToday,
  differenceInDays,
} from "date-fns";
import { he } from "date-fns/locale";

interface AdminTask {
  id: string;
  work_type: string;
  status: string;
  due_date: string | null;
  frequency: string;
  executor: string | null;
  created_at: string;
  branches: {
    name: string;
    city: string | null;
    networks: { name: string } | null;
  } | null;
}

function getUrgencyScore(t: AdminTask): number {
  if (t.status === "completed" || t.status === "cancelled") return 0;
  if (t.frequency === "one_time" && !t.due_date) {
    const days = differenceInDays(new Date(), parseISO(t.created_at));
    if (days > 14) return 3;
  }
  if (!t.due_date) return 0;
  const daysLeft = differenceInDays(parseISO(t.due_date), new Date());
  if (daysLeft < 0) return 4;
  if (t.frequency === "monthly" && daysLeft <= 14) return 3;
  if ((t.frequency === "quarterly" || t.frequency === "semi_annual") && daysLeft <= 30) return 2;
  if (t.frequency === "one_time" && differenceInDays(new Date(), parseISO(t.created_at)) > 14) return 3;
  return 0;
}

function isOverdue(task: AdminTask) {
  if (task.status === "completed" || task.status === "cancelled" || !task.due_date) return false;
  return differenceInDays(new Date(), parseISO(task.due_date)) > 0;
}

function getTaskColor(task: AdminTask) {
  if (task.status === "completed") return "bg-emerald-500";
  if (task.status === "cancelled") return "bg-muted-foreground";
  if (isOverdue(task)) return "bg-red-500";
  const urgency = getUrgencyScore(task);
  if (urgency >= 2) return "bg-amber-500";
  return "bg-yellow-400";
}

const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const STATUS_OPTIONS = [
  { value: "pending", label: "ממתין" },
  { value: "in_progress", label: "בביצוע" },
  { value: "completed", label: "הושלם" },
  { value: "cancelled", label: "בוטל" },
];

export default function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [viewTask, setViewTask] = useState<AdminTask | null>(null);

  const { data: allTasks = [] } = useQuery({
    queryKey: ["admin-calendar-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, work_type, status, due_date, frequency, executor, created_at, branches(name, city, networks(name))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as AdminTask[];
    },
  });

  // Extract unique executors
  const executors = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach((t) => { if (t.executor) set.add(t.executor); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (selectedExecutors.length > 0 && (!t.executor || !selectedExecutors.includes(t.executor))) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(t.status)) return false;
      return true;
    });
  }, [allTasks, selectedExecutors, selectedStatuses]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, AdminTask[]>();
    filteredTasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTasks]);

  const noDueDateTasks = useMemo(
    () => filteredTasks.filter((t) => !t.due_date && t.status !== "completed" && t.status !== "cancelled"),
    [filteredTasks]
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return tasksByDate.get(key) || [];
  }, [selectedDate, tasksByDate]);

  const firstDayOffset = getDay(startOfMonth(currentMonth));

  const toggleFilter = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const activeFilters = selectedExecutors.length + selectedStatuses.length;

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">לוח שנה</h1>
            <p className="text-muted-foreground text-sm mt-1">תצוגת משימות חודשית</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" />
                מבצע
                {selectedExecutors.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{selectedExecutors.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <ScrollArea className="max-h-64">
                <div className="space-y-1">
                  {executors.map((ex) => (
                    <label key={ex} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedExecutors.includes(ex)}
                        onCheckedChange={() => toggleFilter(ex, selectedExecutors, setSelectedExecutors)}
                      />
                      {ex}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" />
                סטטוס
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{selectedStatuses.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedStatuses.includes(s.value)}
                      onCheckedChange={() => toggleFilter(s.value, selectedStatuses, setSelectedStatuses)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedExecutors([]); setSelectedStatuses([]); }}>
              איפוס ({activeFilters})
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar */}
          <div className="lg:col-span-2 space-y-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between bg-card rounded-lg border shadow-card p-3">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-bold text-foreground">
                {format(currentMonth, "MMMM yyyy", { locale: he })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>

            <div className="bg-card rounded-lg border shadow-card p-4">
              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`e-${i}`} className="aspect-square" />
                ))}
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayTasks = tasksByDate.get(key) || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const hasCompleted = dayTasks.some((t) => t.status === "completed");
                  const hasUrgent = dayTasks.some((t) => getUrgencyScore(t) >= 2);
                  const hasOverdue = dayTasks.some((t) => isOverdue(t));
                  const hasPending = dayTasks.some((t) => t.status !== "completed" && t.status !== "cancelled" && !isOverdue(t));

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all text-sm
                        ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : ""}
                        ${today && !isSelected ? "bg-accent font-bold" : ""}
                        ${!isSelected && !today ? "hover:bg-muted" : ""}
                      `}
                    >
                      <span className={isSelected ? "font-bold" : ""}>{format(day, "d")}</span>
                      {dayTasks.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {hasOverdue && (
                            <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-red-500"}`} />
                          )}
                          {hasPending && (
                            <span className={`h-1.5 w-1.5 rounded-full ${hasUrgent ? "bg-amber-500" : isSelected ? "bg-primary-foreground" : "bg-yellow-400"}`} />
                          )}
                          {hasCompleted && (
                            <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground/70" : "bg-emerald-500"}`} />
                          )}
                          {dayTasks.length > 1 && (
                            <span className={`text-[9px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {dayTasks.length}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border justify-center flex-wrap">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" /> פתוח
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> דחוף
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> באיחור!!!
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> הושלם
                </div>
              </div>
            </div>
          </div>

          {/* Side panel - selected date tasks / no-due-date */}
          <div className="space-y-4">
            {selectedDate ? (
              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground">
                  {format(selectedDate, "EEEE, d MMMM", { locale: he })}
                  <span className="text-sm font-normal text-muted-foreground mr-2">({selectedTasks.length} משימות)</span>
                </h3>
                {selectedTasks.length === 0 ? (
                  <div className="bg-card rounded-lg border shadow-card p-6 text-center">
                    <p className="text-muted-foreground">אין משימות ביום זה</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {selectedTasks.map((t) => (
                        <AdminTaskCard key={t.id} task={t} onClick={() => setViewTask(t)} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg border shadow-card p-6 text-center">
                <p className="text-muted-foreground text-sm">לחץ על יום בלוח לצפייה במשימות</p>
              </div>
            )}

            {noDueDateTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  משימות ללא תאריך יעד ({noDueDateTasks.length})
                </h3>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {noDueDateTasks.slice(0, 20).map((t) => (
                      <AdminTaskCard key={t.id} task={t} onClick={() => setViewTask(t)} />
                    ))}
                    {noDueDateTasks.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        ועוד {noDueDateTasks.length - 20} משימות...
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Task detail dialog */}
        <Dialog open={!!viewTask} onOpenChange={(open) => !open && setViewTask(null)}>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                פרטי משימה
              </DialogTitle>
            </DialogHeader>
            {viewTask && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">רשת:</span>
                    <p className="font-semibold">{viewTask.branches?.networks?.name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">סניף:</span>
                    <p className="font-semibold">{viewTask.branches?.name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">סוג עבודה:</span>
                    <p className="font-semibold">{viewTask.work_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">מבצע:</span>
                    <p className="font-semibold">{viewTask.executor || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">תאריך יעד:</span>
                    <p className="font-semibold">{viewTask.due_date ? format(parseISO(viewTask.due_date), "dd/MM/yyyy") : "לא הוגדר"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">סטטוס:</span>
                    <Badge variant="outline" className={`text-xs ${getTaskColor(viewTask)} text-white border-0`}>
                      {viewTask.status === "completed" ? "הושלם" : viewTask.status === "cancelled" ? "בוטל" : isOverdue(viewTask) ? "באיחור" : "פתוח"}
                    </Badge>
                  </div>
                </div>
                {viewTask.status === "completed" && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-sm mb-3">דו״ח ביצוע</h3>
                    <FieldReportViewer taskId={viewTask.id} />
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function AdminTaskCard({ task, onClick }: { task: AdminTask; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-right">
      <div className="bg-card rounded-lg border shadow-card p-3 flex items-center gap-3 hover:shadow-elevated transition-all cursor-pointer">
        <div className={`w-1 self-stretch rounded-full ${getTaskColor(task)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm truncate">{task.branches?.networks?.name || "—"}</span>
            {task.status === "completed" && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">הושלמה ✓</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.branches?.name || "—"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.work_type}</p>
          {task.executor && (
            <p className="text-[10px] text-muted-foreground mt-0.5">מבצע: {task.executor}</p>
          )}
        </div>
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span>{format(parseISO(task.due_date), "dd/MM")}</span>
          </div>
        )}
      </div>
    </button>
  );
}
