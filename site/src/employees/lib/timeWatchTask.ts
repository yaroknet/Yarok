import { supabase } from "@/employees/integrations/supabase/client";

const ORIT_USER_ID = "d0175b71-1a13-4a93-93b2-d984738cf346";

/**
 * Creates a personal task for Orit to update Time Watch system
 * whenever a service is created or updated (start/update/stop).
 */
export async function createTimeWatchTask(params: {
  actionType: "start" | "update" | "stop";
  networkName: string;
  branchName: string;
  assignedToName?: string;
  daysPerWeek?: number;
  hoursPerVisit?: number;
  dateOption?: string;
  specificDate?: string | null;
  notes?: string;
}) {
  const { actionType, networkName, branchName, assignedToName, daysPerWeek, hoursPerVisit, dateOption, specificDate, notes } = params;

  const actionLabel = actionType === "start" ? "התחלת שירות" : actionType === "update" ? "עדכון שירות" : "הפסקת שירות";

  const details: string[] = [];
  details.push(`סוג: ${actionLabel}`);
  details.push(`רשת: ${networkName}`);
  details.push(`סניף: ${branchName}`);
  if (assignedToName) details.push(`מבצע: ${assignedToName}`);
  if (daysPerWeek) details.push(`ימים בשבוע: ${daysPerWeek}`);
  if (hoursPerVisit) details.push(`שעות בביקור: ${hoursPerVisit}`);
  if (dateOption === "specific" && specificDate) {
    details.push(`תאריך: ${specificDate}`);
  } else if (dateOption === "immediate") {
    details.push(`תאריך: מיידי`);
  } else if (dateOption === "asap") {
    details.push(`תאריך: בהקדם`);
  }
  if (notes) details.push(`הערות: ${notes}`);

  const title = `נא לבצע את השינוי במערכת ה Time Watch — ${actionLabel} — ${networkName}, ${branchName}`;
  const taskNotes = details.join("\n");

  await supabase.from("personal_tasks").insert({
    title,
    notes: taskNotes,
    assigned_to: ORIT_USER_ID,
    created_by: ORIT_USER_ID,
    is_recurring: false,
    reminder_frequency: "at_08:30",
    urgency: "high",
    is_important: true,
    status: "not_done",
  } as any);
}
