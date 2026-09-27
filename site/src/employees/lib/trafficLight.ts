import { differenceInDays, isPast, isValid, parseISO } from "date-fns";

export type TrafficLight = "red" | "orange" | "green";

export interface TrafficLightResult {
  color: TrafficLight;
  label: string;
  className: string;
}

export function getTrafficLight(
  status: string,
  dueDate: string | null,
  frequency: string
): TrafficLightResult {
  if (status === "completed") {
    return { color: "green", label: "הושלם", className: "status-green" };
  }

  if (status === "frozen") {
    return { color: "green", label: "מוקפא", className: "bg-muted text-muted-foreground" };
  }

  if (!dueDate) {
    return { color: "green", label: "ממתין", className: "bg-muted text-muted-foreground" };
  }

  const due = parseISO(dueDate);
  if (!isValid(due)) {
    return { color: "green", label: "ממתין", className: "bg-muted text-muted-foreground" };
  }

  const today = new Date();
  const daysUntilDue = differenceInDays(due, today);
  const isRecurring = frequency === "monthly" || frequency === "quarterly";

  if (isPast(due)) {
    if (isRecurring) {
      return { color: "red", label: "באיחור", className: "status-red" };
    }
    if (Math.abs(daysUntilDue) > 14) {
      return { color: "red", label: "באיחור", className: "status-red" };
    }
    return { color: "orange", label: "באיחור", className: "status-orange" };
  }

  if (isRecurring && daysUntilDue <= 10 && daysUntilDue >= 0) {
    return { color: "orange", label: "בקרוב", className: "status-orange" };
  }

  if (!isRecurring && daysUntilDue <= 7 && daysUntilDue >= 0) {
    return { color: "orange", label: "בקרוב", className: "status-orange" };
  }

  return { color: "green", label: "תקין", className: "bg-muted text-muted-foreground" };
}
