import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseReminderLabel } from "@/employees/components/personal-tasks/ReminderPicker";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Switch } from "@/employees/components/ui/switch";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Label } from "@/employees/components/ui/label";
import { Badge } from "@/employees/components/ui/badge";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { ScheduleForm, ScheduleConfig } from "./ScheduleForm";

const SUMMARY_TYPE_LABELS: Record<string, string> = {
  all_open: "כל הפתוחים",
  today_opened: "נפתחו היום",
  personal: "אישי",
  whatsapp_log: "לוג הודעות",
};

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function WhatsAppSchedules() {
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<ScheduleConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterRecipient, setFilterRecipient] = useState<string>("all");

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["whatsapp-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_schedule_config")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        schedule_days: s.schedule_days || [],
        filter_work_types: s.filter_work_types || [],
      })) as ScheduleConfig[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_schedule_config")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-schedules"] });
      toast.success("עודכן בהצלחה");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_schedule_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-schedules"] });
      toast.success("נמחק בהצלחה");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Partial<ScheduleConfig>) => {
      if (item.id) {
        const { error } = await supabase
          .from("whatsapp_schedule_config")
          .update(item)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_schedule_config")
          .insert(item as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-schedules"] });
      toast.success("נשמר בהצלחה");
      setIsDialogOpen(false);
      setEditItem(null);
    },
  });

  const openNew = () => {
    setEditItem({
      id: "",
      name: "",
      description: "",
      recipient_name: "",
      recipient_phone: "",
      schedule_type: "daily",
      schedule_time: "18:00",
      schedule_day: null,
      schedule_days: [0, 1, 2, 3, 4, 5, 6],
      summary_type: "all_open",
      filter_roles: [],
      filter_work_types: [],
      include_user_ids: [],
      exclude_names: [],
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const getDaysLabel = (days: number[]) => {
    if (!days || days.length === 0) return "ללא ימים";
    if (days.length === 7) return "כל יום";
    if (days.length === 5 && !days.includes(5) && !days.includes(6)) return "ימי חול";
    return days.sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(", ");
  };

  const uniqueRecipients = Array.from(new Set(schedules.map((s) => s.recipient_name))).sort();
  const filteredSchedules = filterRecipient === "all"
    ? schedules
    : schedules.filter((s) => s.recipient_name === filterRecipient);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">סיכומים מתוזמנים</h2>
        <div className="flex items-center gap-2">
          <Select value={filterRecipient} onValueChange={setFilterRecipient}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="סנן לפי נמען" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הנמענים</SelectItem>
              {uniqueRecipients.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            הוסף תזמון
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">טוען...</p>
      ) : filteredSchedules.length === 0 ? (
        <p className="text-muted-foreground text-sm">אין תזמונים {filterRecipient !== "all" ? `עבור ${filterRecipient}` : "מוגדרים"}</p>
      ) : (
        <div className="grid gap-3">
          {filteredSchedules.map((s) => (
            <Card key={s.id} className={!s.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {getDaysLabel(s.schedule_days)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {SUMMARY_TYPE_LABELS[s.summary_type] || s.summary_type}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.schedule_time}
                      </span>
                      <span>📱 {s.recipient_name} ({s.recipient_phone})</span>
                      {s.exclude_names.length > 0 && (
                        <span>🚫 {s.exclude_names.join(", ")}</span>
                      )}
                      {s.filter_work_types && s.filter_work_types.length > 0 && (
                        <span>🔧 {s.filter_work_types.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: s.id, is_active: checked })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setEditItem(s); setIsDialogOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("למחוק תזמון זה?")) deleteMutation.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "עריכת תזמון" : "תזמון חדש"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <ScheduleForm
              item={editItem}
              onSave={(data) => saveMutation.mutate(data)}
              saving={saveMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

