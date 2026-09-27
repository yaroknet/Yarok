import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Label } from "@/employees/components/ui/label";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/employees/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/employees/lib/utils";
import { ReminderPicker, parseReminderLabel } from "@/employees/components/personal-tasks/ReminderPicker";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "מנהל על",
  office_manager: "מנהל משרד",
  team_leader: "מנהל אזור",
  contractor: "קבלן",
  contractor_worker: "עובד קבלן",
  customer: "לקוח",
};

export interface ScheduleConfig {
  id: string;
  name: string;
  description: string | null;
  recipient_name: string;
  recipient_phone: string;
  schedule_type: string;
  schedule_time: string;
  schedule_day: number | null;
  schedule_days: number[];
  summary_type: string;
  filter_roles: string[];
  filter_work_types: string[];
  include_user_ids: string[];
  exclude_names: string[];
  is_active: boolean;
}

interface UserWithRole {
  user_id: string;
  full_name: string;
  phone: string;
  role: string;
}

// Convert schedule config to ReminderPicker format
function configToReminderValue(config: ScheduleConfig): string | null {
  const days = config.schedule_days || [];
  const time = config.schedule_time || "18:00";

  if (days.length === 0) return `at_${time}`;
  if (days.length === 7) return `at_${time}`;

  const sorted = [...days].sort((a, b) => a - b);
  return `weekly_${sorted.join(",")}_${time}`;
}

// Convert ReminderPicker value back to schedule config fields
function reminderValueToConfig(value: string | null): {
  schedule_time: string;
  schedule_days: number[];
  schedule_type: string;
  schedule_day: number | null;
} {
  if (!value) return { schedule_time: "18:00", schedule_days: [], schedule_type: "daily", schedule_day: null };

  if (value.startsWith("at_")) {
    const time = value.replace("at_", "");
    return { schedule_time: time, schedule_days: [0, 1, 2, 3, 4, 5, 6], schedule_type: "daily", schedule_day: 0 };
  }

  if (value.startsWith("weekly_")) {
    const parts = value.replace("weekly_", "");
    const [daysPart, time] = parts.split("_");
    const days = daysPart.split(",").map(Number);
    return { schedule_time: time || "18:00", schedule_days: days, schedule_type: "weekly", schedule_day: days[0] || null };
  }

  if (value.startsWith("every_")) {
    const raw = value.replace("every_", "");
    if (raw.endsWith("d")) {
      return { schedule_time: "18:00", schedule_days: [0, 1, 2, 3, 4, 5, 6], schedule_type: "daily", schedule_day: null };
    }
    if (raw.endsWith("w")) {
      return { schedule_time: "18:00", schedule_days: [0], schedule_type: "weekly", schedule_day: 0 };
    }
    return { schedule_time: "18:00", schedule_days: [0, 1, 2, 3, 4, 5, 6], schedule_type: "daily", schedule_day: null };
  }

  if (value.startsWith("once_")) {
    const dt = value.replace("once_", "");
    const [, t] = dt.split("T");
    return { schedule_time: t || "18:00", schedule_days: [], schedule_type: "once", schedule_day: null };
  }

  return { schedule_time: "18:00", schedule_days: [0, 1, 2, 3, 4, 5, 6], schedule_type: "daily", schedule_day: null };
}

export function ScheduleForm({
  item,
  onSave,
  saving,
}: {
  item: ScheduleConfig;
  onSave: (data: Partial<ScheduleConfig>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(item);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [reminderValue, setReminderValue] = useState<string | null>(configToReminderValue(item));

  const { data: workTypes = [] } = useQuery({
    queryKey: ["distinct-work-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("work_type")
        .order("work_type");
      if (error) throw error;
      const unique = [...new Set((data || []).map((t: any) => t.work_type))].filter(Boolean) as string[];
      return unique;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["system-users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .order("full_name");
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => {
        roleMap[r.user_id] = r.role;
      });

      return (data || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || "",
        phone: p.phone || "",
        role: roleMap[p.user_id] || "unknown",
      })) as UserWithRole[];
    },
  });

  const toggleWorkType = (wt: string) => {
    setForm((prev) => {
      const types = prev.filter_work_types.includes(wt)
        ? prev.filter_work_types.filter((t) => t !== wt)
        : [...prev.filter_work_types, wt];
      return { ...prev, filter_work_types: types };
    });
  };

  const toggleUser = (userId: string) => {
    setForm((prev) => {
      const ids = prev.include_user_ids.includes(userId)
        ? prev.include_user_ids.filter((id) => id !== userId)
        : [...prev.include_user_ids, userId];
      return { ...prev, include_user_ids: ids };
    });
  };

  const selectByRole = (role: string) => {
    const roleUserIds = users.filter((u) => u.role === role).map((u) => u.user_id);
    setForm((prev) => {
      const merged = new Set([...prev.include_user_ids, ...roleUserIds]);
      return { ...prev, include_user_ids: Array.from(merged) };
    });
  };

  const selectAll = () => {
    setForm({ ...form, include_user_ids: users.map((u) => u.user_id) });
  };

  const clearUsers = () => {
    setForm({ ...form, include_user_ids: [] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduleFields = reminderValueToConfig(reminderValue);
    const data: any = {
      ...form,
      ...scheduleFields,
    };
    if (!data.id) delete data.id;
    data.exclude_names = [];
    data.filter_roles = [];
    onSave(data);
  };

  const filteredUsers = users.filter((u) => !["super_admin", "office_manager"].includes(u.role) || u.full_name === "אילן");
  const groupedUsers = filteredUsers.reduce<Record<string, UserWithRole[]>>((acc, u) => {
    const role = u.role;
    if (!acc[role]) acc[role] = [];
    acc[role].push(u);
    return acc;
  }, {});

  const roleOrder = ["office_manager", "team_leader", "contractor", "contractor_worker", "customer"];
  const sortedRoles = roleOrder.filter((r) => groupedUsers[r]?.length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>שם</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label>תיאור</Label>
          <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>

      {/* Recipient autocomplete */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>שם הנמען</Label>
          <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal"
              >
                {form.recipient_name || "בחר או הקלד..."}
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" dir="rtl">
              <Command>
                <CommandInput placeholder="חפש משתמש..." />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    {users.map((u) => (
                      <CommandItem
                        key={u.user_id}
                        value={u.full_name}
                        onSelect={() => {
                          setForm({
                            ...form,
                            recipient_name: u.full_name,
                            recipient_phone: u.phone,
                          });
                          setRecipientOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            form.recipient_name === u.full_name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {u.full_name}
                        <span className="text-muted-foreground text-xs mr-2">
                          ({ROLE_LABELS[u.role] || u.role})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input
            value={form.recipient_name}
            onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
            placeholder="או הקלד שם ידנית"
            className="mt-1"
          />
        </div>
        <div className="space-y-1.5">
          <Label>טלפון</Label>
          <Input
            value={form.recipient_phone}
            onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
            required
            dir="ltr"
          />
        </div>
      </div>

      {/* Enhanced schedule picker */}
      <div className="space-y-2">
        <Label>תזמון שליחה</Label>
        <div className="border rounded-lg p-3 bg-muted/20">
          <ReminderPicker
            value={reminderValue}
            onChange={setReminderValue}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>סוג סיכום</Label>
        <Select value={form.summary_type} onValueChange={(v) => setForm({ ...form, summary_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all_open">כל המשימות והשירותים הפתוחים</SelectItem>
            <SelectItem value="today_opened">מה שנפתח היום</SelectItem>
            <SelectItem value="whatsapp_log">לוג הודעות שנשלחו</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Work type filter */}
      <div className="space-y-2">
        <Label>סינון לפי סוג עבודה</Label>
        <p className="text-xs text-muted-foreground">אם לא נבחר כלום — הסיכום כולל את כל סוגי העבודה</p>
        <div className="flex gap-1.5 flex-wrap">
          {workTypes.map((wt) => (
            <label
              key={wt}
              className={`flex items-center gap-1.5 cursor-pointer text-sm px-3 py-2 rounded-lg border transition-colors ${
                form.filter_work_types.includes(wt)
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "bg-muted/30 border-border"
              }`}
            >
              <Checkbox
                checked={form.filter_work_types.includes(wt)}
                onCheckedChange={() => toggleWorkType(wt)}
                className="h-4 w-4"
              />
              {wt}
            </label>
          ))}
        </div>
        {form.filter_work_types.length > 0 && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-primary font-medium">
              נבחרו: {form.filter_work_types.join(", ")}
            </p>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setForm({ ...form, filter_work_types: [] })}>
              נקה
            </Button>
          </div>
        )}
      </div>

      {/* User inclusion list */}
      <div className="space-y-2">
        <Label>משתמשים לכלול בסיכום</Label>
        <div className="flex gap-2 flex-wrap text-xs">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={selectAll}>כולם</Button>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => {
            selectByRole("team_leader");
            selectByRole("contractor");
            selectByRole("contractor_worker");
          }}>כל משתמשי מערכת</Button>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectByRole("contractor")}>כל הקבלנים</Button>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectByRole("team_leader")}>כל מנהלי אזור</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearUsers}>נקה</Button>
        </div>
        <div className="border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
          {sortedRoles.map((role) => (
            <div key={role} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">{ROLE_LABELS[role] || role}</p>
              <div className="grid grid-cols-2 gap-1">
                {groupedUsers[role].map((u) => (
                  <label
                    key={u.user_id}
                    className={`flex items-center gap-2 cursor-pointer text-sm px-2 py-1.5 rounded-md transition-colors ${
                      form.include_user_ids.includes(u.user_id)
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={form.include_user_ids.includes(u.user_id)}
                      onCheckedChange={() => toggleUser(u.user_id)}
                      className="h-4 w-4"
                    />
                    {u.full_name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {form.include_user_ids.length} משתמשים נבחרו
        </p>
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "שומר..." : "שמור"}
      </Button>
    </form>
  );
}
