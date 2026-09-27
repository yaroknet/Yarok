import { useState, useMemo } from "react";
import { TeamTask, getUrgencyScore, getOverdueDays } from "@/employees/hooks/useTeamTasks";
import { TaskListCard } from "./TaskListCard";
import { SortFilterSheet, SortOption } from "./SortFilterSheet";
import { Input } from "@/employees/components/ui/input";
import { Button } from "@/employees/components/ui/button";
import { Search, Download, Filter } from "lucide-react";
import * as XLSX from "xlsx";

interface TasksTabProps {
  tasks: TeamTask[];
  filter?: string;
  onSelectTask: (task: TeamTask) => void;
}

export function TasksTab({ tasks, filter, onSelectTask }: TasksTabProps) {
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [search, setSearch] = useState("");

  const openTasks = useMemo(() => {
    let list = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

    if (filter === "urgent") {
      list = list.filter((t) => getUrgencyScore(t) >= 2);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.branches?.networks?.name?.toLowerCase().includes(q) ||
          t.branches?.name?.toLowerCase().includes(q) ||
          t.work_type.toLowerCase().includes(q) ||
          t.branches?.city?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      switch (sortBy) {
        case "urgency":
          return getUrgencyScore(b) - getUrgencyScore(a) || getOverdueDays(b) - getOverdueDays(a);
        case "due_date":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        case "client":
          return (a.branches?.networks?.name || "").localeCompare(b.branches?.networks?.name || "");
        case "type":
          return a.work_type.localeCompare(b.work_type);
        default:
          return 0;
      }
    });
  }, [tasks, filter, sortBy, search]);

  const statusLabels: Record<string, string> = {
    pending: "ממתינה",
    in_progress: "בביצוע",
    completed: "הושלמה",
    cancelled: "בוטלה",
  };

  const frequencyLabels: Record<string, string> = {
    one_time: "חד פעמי",
    monthly: "חודשי",
    quarterly: "רבעוני",
    half_yearly: "חצי שנתי",
    yearly: "שנתי",
  };

  const exportToExcel = () => {
    const isVitrinas = (t: TeamTask) => t.work_type?.includes("ויטרינ");

    const data = openTasks.map((t) => ({
      "רשת": t.branches?.networks?.name || "",
      "סניף": t.branches?.name || "",
      "סוג עבודה": t.work_type,
      "צדדים": isVitrinas(t) ? t.sides_required : "",
      "סטטוס": statusLabels[t.status] || t.status,
      "תאריך יעד": t.due_date || "",
      "תדירות": frequencyLabels[t.frequency] || t.frequency,
      "הערות": t.admin_notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משימות");
    XLSX.writeFile(wb, "tasks_export.xlsx");
  };

  return (
    <div className="px-4 pb-24 space-y-3 pt-2">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי ישוב, סניף, עיר..."
          className="pr-10 rounded-xl h-11 bg-card border-border"
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {filter === "urgent" ? "משימות דחופות" : "משימות פתוחות"}
          <span className="text-sm font-normal text-muted-foreground mr-2">({openTasks.length})</span>
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={exportToExcel} className="h-8 px-2 text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {openTasks.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-muted-foreground font-medium text-sm">
            {search ? "לא נמצאו תוצאות" : "אין משימות פתוחות! עבודה מצוינת."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {openTasks.map((t, idx) => (
            <div key={t.id} className="animate-fade-in" style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}>
              <TaskListCard task={t} onSelect={onSelectTask} />
            </div>
          ))}
        </div>
      )}

      <SortFilterSheet current={sortBy} onChange={setSortBy} />
    </div>
  );
}
