import { useState, useMemo } from "react";
import { TeamTask, getUrgencyScore } from "@/employees/hooks/useTeamTasks";
import { Badge } from "@/employees/components/ui/badge";
import { Button } from "@/employees/components/ui/button";
import { ChevronRight, ChevronLeft, MapPin, Clock, AlertCircle } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, getDay, parseISO, isToday,
  differenceInDays,
} from "date-fns";
import { he } from "date-fns/locale";

interface CalendarTabProps {
  tasks: TeamTask[];
  onSelectTask: (task: TeamTask) => void;
}

const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function isOverdue(task: TeamTask) {
  if (task.status === "completed" || task.status === "cancelled" || !task.due_date) return false;
  return differenceInDays(new Date(), parseISO(task.due_date)) > 0;
}

function getTaskColor(task: TeamTask) {
  if (task.status === "completed") return "bg-emerald-500";
  if (task.status === "cancelled") return "bg-muted-foreground";
  if (isOverdue(task)) return "bg-red-500";
  const urgency = getUrgencyScore(task);
  if (urgency >= 2) return "bg-amber-500";
  return "bg-yellow-400";
}

export function CalendarTab({ tasks, onSelectTask }: CalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Map dates to tasks
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date; // yyyy-mm-dd
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  // Get tasks without due_date (pinned at top)
  const noDueDateTasks = useMemo(
    () => tasks.filter((t) => !t.due_date && t.status !== "completed" && t.status !== "cancelled"),
    [tasks]
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return tasksByDate.get(key) || [];
  }, [selectedDate, tasksByDate]);

  // Padding for first day of month
  const firstDayOffset = getDay(startOfMonth(currentMonth)); // 0=Sun

  return (
    <div className="px-4 pb-24 space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl border shadow-card p-3">
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

      {/* Calendar grid */}
      <div className="bg-card rounded-2xl border shadow-card p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(key) || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            const hasCompleted = dayTasks.some((t) => t.status === "completed");
            const hasUrgent = dayTasks.some((t) => getUrgencyScore(t) >= 2);
            const hasOverdue = dayTasks.some((t) => isOverdue(t));
            const hasPending = dayTasks.some(
              (t) => t.status !== "completed" && t.status !== "cancelled" && !isOverdue(t)
            );

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all text-sm
                  ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : ""}
                  ${today && !isSelected ? "bg-accent font-bold" : ""}
                  ${!isSelected && !today ? "hover:bg-muted" : ""}
                `}
              >
                <span className={`${isSelected ? "font-bold" : ""}`}>{format(day, "d")}</span>
                {dayTasks.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasOverdue && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-red-500"}`} />
                    )}
                    {hasPending && (
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        hasUrgent ? "bg-amber-500" : isSelected ? "bg-primary-foreground" : "bg-yellow-400"
                      }`} />
                    )}
                    {hasCompleted && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-primary-foreground/70" : "bg-emerald-500"
                        }`}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border justify-center flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            פתוח
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            דחוף
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            באיחור!!!
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            הושלם
          </div>
        </div>
      </div>

      {/* Tasks without due date */}
      {noDueDateTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            משימות ללא תאריך יעד ({noDueDateTasks.length})
          </h3>
          {noDueDateTasks.map((t) => (
            <TaskDayCard key={t.id} task={t} onSelect={onSelectTask} />
          ))}
        </div>
      )}

      {/* Selected date tasks */}
      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-base font-bold text-foreground">
            {format(selectedDate, "EEEE, d MMMM", { locale: he })}
            <span className="text-sm font-normal text-muted-foreground mr-2">
              ({selectedTasks.length} משימות)
            </span>
          </h3>
          {selectedTasks.length === 0 ? (
            <div className="bg-card rounded-2xl border shadow-card p-6 text-center">
              <p className="text-muted-foreground">אין משימות ביום זה</p>
            </div>
          ) : (
            selectedTasks.map((t) => (
              <TaskDayCard key={t.id} task={t} onSelect={onSelectTask} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TaskDayCard({ task, onSelect }: { task: TeamTask; onSelect: (t: TeamTask) => void }) {
  const isCompleted = task.status === "completed";

  return (
    <button
      onClick={() => onSelect(task)}
      className="w-full text-right"
    >
      <div className={`bg-card rounded-xl border shadow-card p-3 flex items-center gap-3 transition-all hover:shadow-elevated ${
        isCompleted ? "opacity-75" : ""
      }`}>
        <div className={`w-1 self-stretch rounded-full ${getTaskColor(task)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm truncate">{task.branches?.networks?.name}</span>
            {isCompleted && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                הושלמה ✓
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.branches?.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.work_type}</p>
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
