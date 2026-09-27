import { MapPin, Clock, Camera, Video, AlertTriangle, Pin, ChevronLeft } from "lucide-react";
import { Badge } from "@/employees/components/ui/badge";
import { TeamTask, getOverdueDays } from "@/employees/hooks/useTeamTasks";
import { getTrafficLight } from "@/employees/lib/trafficLight";

const frequencyLabels: Record<string, string> = {
  one_time: "חד פעמי",
  monthly: "חודשי",
  quarterly: "רבעוני",
  half_yearly: "חצי שנתי",
};

interface TaskListCardProps {
  task: TeamTask;
  onSelect: (task: TeamTask) => void;
}

function getColorBorder(task: TeamTask) {
  const overdueDays = getOverdueDays(task);
  if (overdueDays > 0) return "border-r-red-500";
  if (task.status === "completed") return "border-r-emerald-500";
  if (task.work_type?.includes("ויטרינ")) return "border-r-primary";
  const traffic = getTrafficLight(task.status, task.due_date, task.frequency);
  if (traffic.label === "ירוק") return "border-r-emerald-400";
  if (traffic.label === "צהוב") return "border-r-amber-400";
  return "border-r-yellow-400";
}

export function TaskListCard({ task, onSelect }: TaskListCardProps) {
  const traffic = getTrafficLight(task.status, task.due_date, task.frequency);
  const overdueDays = getOverdueDays(task);
  const isPinned = task.frequency === "one_time" && !task.due_date && task.status !== "completed";
  const isVitrinas = task.work_type?.includes("ויטרינ");
  const colorBorder = getColorBorder(task);

  return (
    <button
      className={`w-full text-right bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98] border-r-4 ${colorBorder} ${
        overdueDays > 0 ? "bg-red-50/40 dark:bg-red-950/10" : ""
      }`}
      onClick={() => onSelect(task)}
    >
      <div className="p-4">
        {/* Top row: network name + badges */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-[15px] truncate leading-tight">
              {task.branches?.networks?.name}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 mr-2 shrink-0">
            <Badge className={`${traffic.className} text-[10px] px-2 py-0.5`}>{traffic.label}</Badge>
            {isPinned && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1.5 py-0.5">
                <Pin className="h-3 w-3 ml-0.5" /> דחוף
              </Badge>
            )}
          </div>
        </div>

        {/* Branch + city */}
        <div className="flex items-center gap-1.5 text-muted-foreground text-[13px] mb-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{task.branches?.name}{task.branches?.city ? ` — ${task.branches.city}` : ""}</span>
        </div>

        {/* Work type + frequency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{task.work_type}</span>
            {isVitrinas && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                {task.sides_required} צדדים
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{frequencyLabels[task.frequency] || task.frequency}</span>
        </div>

        {/* Overdue warning */}
        {overdueDays > 0 && (
          <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-2.5 mt-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm font-bold text-red-600 dark:text-red-400">באיחור {overdueDays} ימים!</span>
          </div>
        )}

        {/* Bottom row: date + requirements */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40">
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            {task.due_date && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{task.due_date}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.requires_photo && <Camera className="h-4 w-4 text-amber-500" />}
            {task.requires_video && <Video className="h-4 w-4 text-amber-500" />}
            {task.admin_notes && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            <ChevronLeft className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>
      </div>
    </button>
  );
}
