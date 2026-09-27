import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { differenceInDays, parseISO } from "date-fns";

export interface TeamTask {
  id: string;
  work_type: string;
  branch_id: string;
  assigned_to: string | null;
  executor: string | null;
  status: string;
  due_date: string | null;
  sides_required: number;
  frequency: string;
  requires_photo: boolean;
  requires_video: boolean;
  is_recurring: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  branches: {
    name: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
    networks: { name: string } | null;
  } | null;
}

export function getOverdueDays(t: TeamTask) {
  if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return 0;
  const days = differenceInDays(new Date(), parseISO(t.due_date));
  return days > 0 ? days : 0;
}

export function getUrgencyScore(t: TeamTask): number {
  if (t.status === "completed" || t.status === "cancelled") return 0;

  // One-time with no due_date and > 14 days since creation
  if (t.frequency === "one_time" && !t.due_date) {
    const daysSinceCreation = differenceInDays(new Date(), parseISO(t.created_at));
    if (daysSinceCreation > 14) return 3;
  }

  if (!t.due_date) return 0;

  const daysLeft = differenceInDays(parseISO(t.due_date), new Date());

  // Already overdue
  if (daysLeft < 0) return 3;

  // Monthly: < 14 days
  if (t.frequency === "monthly" && daysLeft < 14) return 2;

  // Quarterly / half-yearly: < 30 days
  if ((t.frequency === "quarterly" || t.frequency === "half_yearly") && daysLeft < 30) return 2;

  // One-time: > 14 days since creation
  if (t.frequency === "one_time") {
    const daysSinceCreation = differenceInDays(new Date(), parseISO(t.created_at));
    if (daysSinceCreation > 14) return 2;
  }

  return 0;
}

export function useTeamTasks() {
  const { user, roles } = useAuth();
  const isContractor = roles.includes("contractor");
  const isTeamLeader = roles.includes("team_leader");

  return useQuery({
    queryKey: ["my-tasks", user?.id, isContractor, isTeamLeader],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("tasks")
        .select("id, work_type, branch_id, assigned_to, executor, status, due_date, sides_required, frequency, requires_photo, requires_video, is_recurring, admin_notes, created_at, updated_at, branches(name, city, lat, lng, networks(name))")
        .order("due_date", { ascending: true });

      if (isContractor || isTeamLeader) {
        // For contractors and team_leaders with partnerships, RLS handles filtering
      } else {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TeamTask[];
    },
    enabled: !!user,
  });
}
