import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Switch } from "@/employees/components/ui/switch";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Textarea } from "@/employees/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Badge } from "@/employees/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/employees/components/ui/dialog";
import { Pencil, Plus, Trash2, Clock, Bell } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const OCCURRENCES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];

interface Reminder {
  id: string;
  reminder_key: string;
  name: string;
  description: string | null;
  recipient_name: string;
  recipient_phone: string;
  schedule_type: "monthly_dates" | "nth_weekday";
  month_days: number[] | null;
  weekday: number | null;
  weekday_occurrence: number | null;
  schedule_time: string;
  pre_saturday_friday: boolean;
  pre_saturday_time: string | null;
  message_body: string;
  link_url: string | null;
  is_active: boolean;
}

const emptyReminder = (): Reminder => ({
  id: "",
  reminder_key: "",
  name: "",
  description: "",
  recipient_name: "",
  recipient_phone: "",
  schedule_type: "monthly_dates",
  month_days: [14, 28],
  weekday: 4,
  weekday_occurrence: 3,
  schedule_time: "09:00",
  pre_saturday_friday: false,
  pre_saturday_time: "08:00",
  message_body: "",
  link_url: "",
  is_active: true,
});

export function CustomReminders() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["custom-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_reminders")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as Reminder[];
    },
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("custom_reminders").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-reminders"] }); toast.success("עודכן"); },
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-reminders"] }); toast.success("נמחק"); },
  });

  const saveM = useMutation({
    mutationFn: async (r: Reminder) => {
      const payload: any = {
        reminder_key: r.reminder_key || `custom_${Date.now()}`,
        name: r.name,
        description: r.description,
        recipient_name: r.recipient_name,
        recipient_phone: r.recipient_phone,
        schedule_type: r.schedule_type,
        month_days: r.schedule_type === "monthly_dates" ? r.month_days : null,
        weekday: r.schedule_type === "nth_weekday" ? r.weekday : null,
        weekday_occurrence: r.schedule_type === "nth_weekday" ? r.weekday_occurrence : null,
        schedule_time: r.schedule_time,
        pre_saturday_friday: r.pre_saturday_friday,
        pre_saturday_time: r.pre_saturday_time,
        message_body: r.message_body,
        link_url: r.link_url || null,
        is_active: r.is_active,
      };
      if (r.id) {
        const { error } = await supabase.from("custom_reminders").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("custom_reminders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-reminders"] });
      toast.success("נשמר בהצלחה");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "שגיאה בשמירה"),
  });

  const scheduleLabel = (r: Reminder) => {
    if (r.schedule_type === "monthly_dates") {
      const days = (r.month_days || []).join(", ");
      return `בכל חודש בתאריכים ${days}`;
    }
    return `יום ${WEEKDAYS[r.weekday ?? 0]} ה${OCCURRENCES[(r.weekday_occurrence ?? 1) - 1]} בחודש`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">תזכורות מותאמות אישית</h2>
        </div>
        <Button size="sm" onClick={() => { setEditing(emptyReminder()); setOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> הוסף תזכורת
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        תזכורות עם טקסט קבוע ולינק, בתאריכי חודש או יום שבוע N בחודש (למשל "החמישי השלישי בחודש"). חסומות בשבת.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">טוען...</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">אין תזכורות מוגדרות</p>
      ) : (
        <div className="grid gap-3">
          {data.map((r) => (
            <Card key={r.id} className={!r.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{r.name}</h3>
                      <Badge variant="outline" className="text-xs">{scheduleLabel(r)}</Badge>
                      {r.pre_saturday_friday && (
                        <Badge variant="secondary" className="text-xs">שישי {r.pre_saturday_time} אם חל בשבת</Badge>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.schedule_time}</span>
                      <span>📱 {r.recipient_name} ({r.recipient_phone})</span>
                      {r.link_url && <span>🔗 לינק מצורף</span>}
                    </div>
                    <p className="text-xs whitespace-pre-line bg-muted/40 p-2 rounded border border-border/60">
                      {r.message_body}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggleM.mutate({ id: r.id, is_active: v })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("למחוק תזכורת זו?")) deleteM.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "עריכת תזכורת" : "תזכורת חדשה"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">שם התזכורת</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">תיאור</Label>
                <Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">שם נמען</Label>
                  <Input value={editing.recipient_name} onChange={(e) => setEditing({ ...editing, recipient_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">טלפון נמען</Label>
                  <Input value={editing.recipient_phone} onChange={(e) => setEditing({ ...editing, recipient_phone: e.target.value })} placeholder="05XXXXXXXX" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">סוג תזמון</Label>
                <Select value={editing.schedule_type} onValueChange={(v: any) => setEditing({ ...editing, schedule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_dates">תאריכים בחודש (למשל 14 ו-28)</SelectItem>
                    <SelectItem value="nth_weekday">יום שבוע N בחודש (למשל החמישי השלישי)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.schedule_type === "monthly_dates" ? (
                <div className="space-y-1.5">
                  <Label className="text-sm">תאריכים בחודש (מופרדים בפסיק, 1-31)</Label>
                  <Input
                    value={(editing.month_days || []).join(", ")}
                    onChange={(e) => {
                      const days = e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 31);
                      setEditing({ ...editing, month_days: days });
                    }}
                    placeholder="14, 28"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">איזה מופע</Label>
                    <Select value={String(editing.weekday_occurrence ?? 3)} onValueChange={(v) => setEditing({ ...editing, weekday_occurrence: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OCCURRENCES.map((label, i) => (
                          <SelectItem key={i} value={String(i + 1)}>ה{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">יום בשבוע</Label>
                    <Select value={String(editing.weekday ?? 4)} onValueChange={(v) => setEditing({ ...editing, weekday: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((label, i) => (
                          <SelectItem key={i} value={String(i)} disabled={i === 6}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">שעת שליחה</Label>
                <Input type="time" value={editing.schedule_time} onChange={(e) => setEditing({ ...editing, schedule_time: e.target.value })} />
              </div>

              {editing.schedule_type === "monthly_dates" && (
                <div className="space-y-2 border border-border/60 rounded-md p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">אם תאריך חל בשבת - שלח ביום שישי במקום</Label>
                    <Switch checked={editing.pre_saturday_friday} onCheckedChange={(v) => setEditing({ ...editing, pre_saturday_friday: v })} />
                  </div>
                  {editing.pre_saturday_friday && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">שעת שליחה ביום שישי</Label>
                      <Input type="time" value={editing.pre_saturday_time || "08:00"} onChange={(e) => setEditing({ ...editing, pre_saturday_time: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">טקסט ההודעה</Label>
                <Textarea
                  rows={5}
                  value={editing.message_body}
                  onChange={(e) => setEditing({ ...editing, message_body: e.target.value })}
                  placeholder="טקסט שיופיע בהודעה לנמען"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">לינק (אופציונלי)</Label>
                <Input value={editing.link_url || ""} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label className="text-sm">פעיל</Label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button
              onClick={() => editing && saveM.mutate(editing)}
              disabled={saveM.isPending || !editing?.name || !editing?.recipient_phone || !editing?.message_body}
            >
              {saveM.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
