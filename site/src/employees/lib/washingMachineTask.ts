import { supabase } from "@/employees/integrations/supabase/client";

const ORIT_USER_ID = "d0175b71-1a13-4a93-93b2-d984738cf346";

/**
 * Creates a personal task for Orit when a washing machine is involved in service start/stop.
 */
export async function createWashingMachineTask(params: {
  actionType: "start" | "stop";
  networkName: string;
  cityName?: string;
  branchName: string;
  dateOption?: string;
  specificDate?: string | null;
}) {
  const { actionType, networkName, cityName, branchName, dateOption, specificDate } = params;
  const location = [networkName, cityName, branchName].filter(Boolean).join(", ");

  let title: string;
  if (actionType === "start") {
    const dateText = dateOption === "specific" && specificDate
      ? specificDate
      : dateOption === "immediate" ? "מיידי" : "בהקדם";
    title = `נא לדאוג לספק מכונת שטיפה ל${location} שתאריך ההתחלה ${dateText}`;
  } else {
    const stopDateText = dateOption === "specific" && specificDate
      ? specificDate
      : "בהקדם";
    title = `נא לדאוג לאיסוף מכונת שטיפה ב${location} עד לתאריך ${stopDateText}`;
  }

  await supabase.from("personal_tasks").insert({
    title,
    assigned_to: ORIT_USER_ID,
    created_by: ORIT_USER_ID,
    is_recurring: true,
    recurrence_day: null,
    reminder_frequency: "at_08:30",
    urgency: "high",
    is_important: true,
    status: "not_done",
  } as any);
}
