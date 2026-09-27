import { differenceInCalendarDays, parseISO } from "date-fns";

// Returns a Date that represents the given moment as it appears in Israel time,
// but expressed in the local timezone — so date-fns calendar helpers compare
// the correct civil date regardless of the runtime timezone.
function toIsraelDate(date: Date): Date {
  const israelStr = date.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
  return new Date(israelStr);
}

// Parse a due_date stored as YYYY-MM-DD as that exact calendar date in Israel
// (avoids the UTC-midnight shift that made "tomorrow" look like "today").
function parseDueDateIsrael(due: string): Date {
  // If only a date is provided, treat it as that local date at midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const [y, m, d] = due.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return toIsraelDate(parseISO(due));
}

interface TaskLike {
  id: string;
  status: string;
  frequency: string;
  due_date: string | null;
  created_at: string;
  work_type: string;
  executor?: string | null;
  branches?: {
    name: string;
    networks?: { name: string } | null;
  } | null;
}

export interface ImportantAlert {
  task: TaskLike;
  reason: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  priority: number; // lower = higher priority
}

/**
 * Determine which tasks should appear as "important alerts" on dashboards.
 */
export function getImportantAlerts(tasks: TaskLike[]): ImportantAlert[] {
  const nowIsrael = toIsraelDate(new Date());
  const currentMonth = nowIsrael.getMonth();
  const dayOfMonth = nowIsrael.getDate();
  const alerts: ImportantAlert[] = [];

  const quarterEndMonths = [2, 5, 8, 11];
  const isLastMonthOfQuarter = quarterEndMonths.includes(currentMonth);

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "cancelled") continue;

    // Compare calendar dates in Israel timezone — never raw timestamps.
    const dueIsrael = task.due_date ? parseDueDateIsrael(task.due_date) : null;
    const daysUntilDue = dueIsrael ? differenceInCalendarDays(dueIsrael, nowIsrael) : null;

    const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
    const isDueSoon = daysUntilDue !== null && !isOverdue && daysUntilDue <= 2;

    // Rule: Due soon (2 days) - highest visual priority
    if (isDueSoon) {
      const daysLeft = daysUntilDue!;
      alerts.push({
        task,
        reason: daysLeft === 0 ? "המשימה מתוזמנת להיום!" : `המשימה מתוזמנת בעוד ${daysLeft === 1 ? "יום אחד" : `${daysLeft} ימים`}!`,
        isOverdue: false,
        isDueSoon: true,
        priority: -1, // above overdue for visual urgency
      });
      continue;
    }

    // Overdue tasks
    if (isOverdue) {
      const daysPast = -daysUntilDue!;
      alerts.push({
        task,
        reason: `באיחור של ${daysPast} ימים`,
        isOverdue: true,
        isDueSoon: false,
        priority: 0,
      });
      continue;
    }

    // One-time without due_date, 14+ days since creation
    if (task.frequency === "one_time" && !task.due_date) {
      const createdIsrael = toIsraelDate(parseISO(task.created_at));
      const daysSinceCreation = differenceInCalendarDays(nowIsrael, createdIsrael);
      if (daysSinceCreation >= 14) {
        alerts.push({
          task,
          reason: `חד פעמית ללא תאריך יעד (${daysSinceCreation} ימים מאז הזנה)`,
          isOverdue: false,
          isDueSoon: false,
          priority: 2,
        });
      }
      continue;
    }

    // Quarterly - last month of quarter
    if (task.frequency === "quarterly" && isLastMonthOfQuarter) {
      alerts.push({
        task,
        reason: "רבעונית — חודש אחרון ברבעון",
        isOverdue: false,
        isDueSoon: false,
        priority: 1,
      });
      continue;
    }

    // Monthly - from 20th onwards
    if (task.frequency === "monthly" && dayOfMonth >= 20) {
      alerts.push({
        task,
        reason: `חודשית — ${30 - dayOfMonth + 1} ימים לסיום החודש`,
        isOverdue: false,
        isDueSoon: false,
        priority: 1,
      });
      continue;
    }
  }

  alerts.sort((a, b) => a.priority - b.priority);
  return alerts;
}
