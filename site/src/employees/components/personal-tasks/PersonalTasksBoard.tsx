import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Textarea } from "@/employees/components/ui/textarea";
import { Badge } from "@/employees/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Switch } from "@/employees/components/ui/switch";
import { Label } from "@/employees/components/ui/label";
import { Plus, Trash2, Star, Bell, StickyNote, Pencil, Repeat, Filter } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/employees/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/employees/components/ui/alert-dialog";
import { ReminderPicker, parseReminderLabel } from "./ReminderPicker";
import { TeamTasksSection } from "./TeamTasksSection";

const USERS = [
  { id: "d0175b71-1a13-4a93-93b2-d984738cf346", name: "אורית עדן" },
  { id: "78e34772-303e-469e-9771-a38aa93ddc2c", name: "מאיה קורן" },
  { id: "5a5d0194-6ce1-448b-a1a7-da4466fcdffc", name: "עוזי זלכה" },
];

const URGENCY_LEVELS = [
  { value: "low", label: "נמוכה", emoji: "🟢", color: "text-green-600" },
  { value: "medium", label: "בינונית", emoji: "🟡", color: "text-yellow-600" },
  { value: "high", label: "גבוהה", emoji: "🟠", color: "text-orange-600" },
  { value: "urgent", label: "דחוף!", emoji: "🔴", color: "text-red-600" },
];

const PERSONAL_STATUS_OPTIONS = [
  { value: "in_progress", label: "בטיפול", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "done", label: "בוצע", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "not_done", label: "לא בוצע", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "follow_up", label: "בהמשך מעקב", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
];

const COLORS = [
  { value: "default", bg: "bg-card", border: "border-border" },
  { value: "yellow", bg: "bg-yellow-50", border: "border-yellow-200" },
  { value: "green", bg: "bg-green-50", border: "border-green-200" },
  { value: "blue", bg: "bg-blue-50", border: "border-blue-200" },
  { value: "pink", bg: "bg-pink-50", border: "border-pink-200" },
  { value: "purple", bg: "bg-purple-50", border: "border-purple-200" },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

type PersonalTask = {
  id: string;
  created_by: string;
  assigned_to: string;
  title: string;
  notes: string | null;
  is_important: boolean;
  is_done: boolean;
  done_at: string | null;
  reminder_frequency: string | null;
  color: string | null;
  urgency: string;
  status: string;
  is_recurring: boolean;
  recurrence_day: number | null;
  created_at: string;
  updated_at: string;
};

export function PersonalTasksBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Per-user add dialog
  const [addForUserId, setAddForUserId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newImportant, setNewImportant] = useState(false);
  const [newReminder, setNewReminder] = useState("none");
  const [newColor, setNewColor] = useState("default");
  const [newUrgency, setNewUrgency] = useState("medium");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrenceDay, setNewRecurrenceDay] = useState("1");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Edit dialog state
  const [editTask, setEditTask] = useState<PersonalTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editUrgency, setEditUrgency] = useState("medium");
  const [editImportant, setEditImportant] = useState(false);
  const [editReminder, setEditReminder] = useState("none");
  const [editColor, setEditColor] = useState("default");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceDay, setEditRecurrenceDay] = useState("1");

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: string; fn: () => void } | null>(null);

  const currentUser = USERS.find((u) => u.id === user?.id);
  const otherUsers = USERS.filter((u) => u.id !== user?.id);
  const isAllowed = USERS.some((u) => u.id === user?.id) || false;

  const getUserName = (id: string) => USERS.find((u) => u.id === id)?.name || "לא ידוע";
  const getColor = (c: string | null) => COLORS.find((col) => col.value === c) || COLORS[0];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["personal-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_tasks" as any)
        .select("*")
        .order("is_done", { ascending: true })
        .order("is_important", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PersonalTask[];
    },
    enabled: isAllowed,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const assignedTo = addForUserId || user!.id;
      const { error } = await supabase.from("personal_tasks" as any).insert({
        created_by: user!.id,
        assigned_to: assignedTo,
        title: newTitle.trim(),
        is_important: newImportant,
        reminder_frequency: newReminder === "none" ? null : newReminder,
        color: newColor,
        urgency: newUrgency,
        is_recurring: newIsRecurring,
        recurrence_day: newIsRecurring ? parseInt(newRecurrenceDay) : null,
      } as any);
      if (error) throw error;

      if (assignedTo !== user!.id) {
        const assigneeName = getUserName(assignedTo);
        const creatorName = getUserName(user!.id);
        const urgencyLabel = URGENCY_LEVELS.find(u => u.value === newUrgency)?.label || "בינונית";
        const urgencyEmoji = URGENCY_LEVELS.find(u => u.value === newUrgency)?.emoji || "🟡";
        const recurringText = newIsRecurring ? `\n🔄 *חוזרת:* בכל ${newRecurrenceDay} לחודש` : "";

        const message = `📋 *משימה חדשה עבורך!*\n\n` +
          `📝 *תיאור:* ${newTitle.trim()}\n` +
          `${urgencyEmoji} *דחיפות:* ${urgencyLabel}\n` +
          `👤 *נוצרה ע"י:* ${creatorName}` +
          recurringText +
          `${newImportant ? "\n⭐ משימה חשובה" : ""}`;

        try {
          await supabase.functions.invoke("whatsapp-notify", {
            body: { recipientName: assigneeName, message: message.trim() },
          });
        } catch (e) {
          console.error("WhatsApp notification failed:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-tasks"] });
      resetNewForm();
      toast.success("משימה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת משימה"),
  });

  const resetNewForm = () => {
    setNewTitle("");
    setNewImportant(false);
    setNewReminder("none");
    setNewColor("default");
    setNewUrgency("medium");
    setNewIsRecurring(false);
    setNewRecurrenceDay("1");
    setAddForUserId(null);
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editTask) return;
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update({
          title: editTitle.trim(),
          assigned_to: editAssignedTo,
          urgency: editUrgency,
          is_important: editImportant,
          reminder_frequency: editReminder === "none" ? null : editReminder,
          color: editColor,
          is_recurring: editIsRecurring,
          recurrence_day: editIsRecurring ? parseInt(editRecurrenceDay) : null,
        } as any)
        .eq("id", editTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-tasks"] });
      setEditTask(null);
      toast.success("משימה עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון משימה"),
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update({ is_done: !is_done, done_at: !is_done ? new Date().toISOString() : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal-tasks"] }),
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update({ notes } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-tasks"] });
      setEditingNoteId(null);
    },
  });

  const toggleImportant = useMutation({
    mutationFn: async ({ id, is_important }: { id: string; is_important: boolean }) => {
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update({ is_important: !is_important } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal-tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-tasks"] });
      toast.success("משימה נמחקה");
    },
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, reminder_frequency }: { id: string; reminder_frequency: string | null }) => {
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update({ reminder_frequency } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal-tasks"] }),
  });

  const updatePersonalStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const isDone = status === "done";
      const update: any = { status, is_done: isDone, done_at: isDone ? new Date().toISOString() : null };
      if (isDone) update.reminder_frequency = null;
      const { error } = await supabase
        .from("personal_tasks" as any)
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal-tasks"] }),
  });

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">אין לך גישה ללוח זה</p>
      </div>
    );
  }

  const openEditDialog = (task: PersonalTask) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditAssignedTo(task.assigned_to);
    setEditUrgency(task.urgency || "medium");
    setEditImportant(task.is_important);
    setEditReminder(task.reminder_frequency || "none");
    setEditColor(task.color || "default");
    setEditIsRecurring(task.is_recurring || false);
    setEditRecurrenceDay(task.recurrence_day?.toString() || "1");
  };

  const withConfirm = (message: string, fn: () => void) => {
    setConfirmAction({ type: message, fn });
  };

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (!showDone && t.is_done) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (searchQuery.trim() && !t.title.includes(searchQuery.trim())) return false;
    return true;
  });

  // Summary stats per user
  const getStatusCounts = (userId: string) => {
    const userTasks = tasks.filter(t => t.assigned_to === userId);
    return {
      total: userTasks.length,
      in_progress: userTasks.filter(t => t.status === "in_progress").length,
      done: userTasks.filter(t => t.status === "done").length,
      not_done: userTasks.filter(t => t.status === "not_done").length,
      follow_up: userTasks.filter(t => t.status === "follow_up").length,
    };
  };

  const renderTask = (task: PersonalTask) => {
    const color = getColor(task.color);
    return (
      <div
        key={task.id}
        className={`p-3 rounded-lg border ${color.bg} ${color.border} ${task.status === "done" ? "opacity-60" : ""} space-y-2 transition-all`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs text-muted-foreground">מאת {getUserName(task.created_by)}</p>
              {(() => {
                const urg = URGENCY_LEVELS.find(u => u.value === task.urgency);
                return urg ? <span className={`text-xs font-medium ${urg.color}`}>{urg.emoji} {urg.label}</span> : null;
              })()}
              {task.is_recurring && (
                <span className="text-xs text-blue-600 flex items-center gap-0.5">
                  <Repeat className="h-3 w-3" />
                  בכל {task.recurrence_day} לחודש
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {task.is_important && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
            {task.reminder_frequency && <Bell className="h-3.5 w-3.5 text-orange-500" />}
          </div>
        </div>

        {editingNoteId === task.id ? (
          <Textarea
            defaultValue={task.notes || ""}
            onBlur={(e) => updateNotes.mutate({ id: task.id, notes: e.target.value })}
            placeholder="הערות..."
            className="text-xs min-h-[50px]"
            dir="rtl"
            autoFocus
          />
        ) : task.notes ? (
          <p
            className="text-xs text-muted-foreground bg-background/50 p-1.5 rounded cursor-pointer hover:bg-background"
            onClick={() => setEditingNoteId(task.id)}
          >
            {task.notes}
          </p>
        ) : (
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditingNoteId(task.id)}
          >
            + הערה
          </button>
        )}

        <div className="flex items-center gap-1 flex-wrap">
          <Select
            value={task.status || "not_done"}
            onValueChange={(v) =>
              withConfirm(`לשנות סטטוס ל"${PERSONAL_STATUS_OPTIONS.find(s => s.value === v)?.label}"?`, () =>
                updatePersonalStatus.mutate({ id: task.id, status: v })
              )
            }
          >
            <SelectTrigger className="h-7 w-auto text-xs border-0 p-0">
              <Badge variant="outline" className={`${(PERSONAL_STATUS_OPTIONS.find(s => s.value === (task.status || "not_done"))?.color) || ""} text-xs`}>
                {PERSONAL_STATUS_OPTIONS.find(s => s.value === (task.status || "not_done"))?.label || "לא בוצע"}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {PERSONAL_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              withConfirm(
                task.is_important ? "להסיר סימון חשוב?" : "לסמן כמשימה חשובה?",
                () => toggleImportant.mutate({ id: task.id, is_important: task.is_important })
              )
            }
          >
            <Star className={`h-3.5 w-3.5 ${task.is_important ? "text-yellow-500 fill-yellow-500" : ""}`} />
          </Button>

          <ReminderPicker
            compact
            value={task.reminder_frequency}
            onChange={(v) =>
              withConfirm("לשנות תדירות תזכורת?", () =>
                updateReminder.mutate({ id: task.id, reminder_frequency: v })
              )
            }
          />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => openEditDialog(task)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive mr-auto"
            onClick={() =>
              withConfirm("האם את/ה בטוח/ה שברצונך למחוק משימה זו?", () =>
                deleteMutation.mutate(task.id)
              )
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderTaskFormContent = (
    mode: "add" | "edit",
    titleVal: string,
    setTitleVal: (v: string) => void,
    assignedTo: string,
    setAssignedToVal: (v: string) => void,
    urgency: string,
    setUrgencyVal: (v: string) => void,
    important: boolean,
    setImportantVal: (v: boolean) => void,
    reminder: string,
    setReminderVal: (v: string) => void,
    colorVal: string,
    setColorVal: (v: string) => void,
    isRecurring: boolean,
    setIsRecurringVal: (v: boolean) => void,
    recurrenceDay: string,
    setRecurrenceDayVal: (v: string) => void,
    onSubmit: () => void,
    isPending: boolean,
    showAssignedTo: boolean,
  ) => (
    <div className="space-y-4">
      <div>
        <Label>תיאור המשימה</Label>
        <Input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} placeholder="מה צריך לעשות?" dir="rtl" />
      </div>
      {showAssignedTo && (
        <div>
          <Label>עבור</Label>
          <Select value={assignedTo || user?.id || ""} onValueChange={setAssignedToVal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USERS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.id === user?.id ? "(אני)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label>רמת דחיפות</Label>
        <Select value={urgency} onValueChange={setUrgencyVal}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {URGENCY_LEVELS.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.emoji} {u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isRecurring} onCheckedChange={setIsRecurringVal} id={`${mode}-recurring`} />
        <Label htmlFor={`${mode}-recurring`}>משימה חוזרת 🔄</Label>
      </div>
      {isRecurring && (
        <div>
          <Label>חוזרת בכל תאריך בחודש</Label>
          <Select value={recurrenceDay} onValueChange={setRecurrenceDayVal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Switch checked={important} onCheckedChange={setImportantVal} id={`${mode}-important`} />
          <Label htmlFor={`${mode}-important`}>תדירות תזכורות WhatsApp 🔔</Label>
        </div>
        {important && (
          <ReminderPicker value={reminder === "none" ? null : reminder} onChange={(v) => setReminderVal(v || "none")} />
        )}
      </div>
      <div>
        <Label>צבע</Label>
        <div className="flex gap-2 mt-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              className={`w-7 h-7 rounded-full border-2 ${c.bg} ${colorVal === c.value ? "ring-2 ring-primary ring-offset-1" : c.border}`}
              onClick={() => setColorVal(c.value)}
            />
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!titleVal.trim() || isPending} onClick={onSubmit}>
        {isPending ? "שומר..." : mode === "add" ? "הוסף משימה" : "שמור שינויים"}
      </Button>
    </div>
  );

  const renderUserBoard = (userId: string, userName: string, isMe: boolean) => {
    const userTasks = filteredTasks.filter((t) => t.assigned_to === userId);
    const counts = getStatusCounts(userId);

    return (
      <Card key={userId}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline">{counts.total}</Badge>
              {isMe ? `המשימות שלי — ${userName}` : `המשימות של ${userName}`}
            </CardTitle>
            <Dialog
              open={addForUserId === userId}
              onOpenChange={(open) => {
                if (open) setAddForUserId(userId);
                else resetNewForm();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>משימה חדשה עבור {userName}</DialogTitle>
                </DialogHeader>
                {renderTaskFormContent(
                  "add", newTitle, setNewTitle, userId, () => {}, 
                  newUrgency, setNewUrgency, newImportant, setNewImportant,
                  newReminder, setNewReminder, newColor, setNewColor,
                  newIsRecurring, setNewIsRecurring, newRecurrenceDay, setNewRecurrenceDay,
                  () => addMutation.mutate(),
                  addMutation.isPending,
                  false,
                )}
              </DialogContent>
            </Dialog>
          </div>
          {/* Mini status summary */}
          <div className="flex gap-1.5 flex-wrap mt-1">
            {counts.in_progress > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5">
                בטיפול {counts.in_progress}
              </Badge>
            )}
            {counts.follow_up > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] h-5">
                מעקב {counts.follow_up}
              </Badge>
            )}
            {counts.not_done > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] h-5">
                לא בוצע {counts.not_done}
              </Badge>
            )}
            {counts.done > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-5">
                בוצע {counts.done}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {userTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">🎉 אין משימות פתוחות</p>
          ) : (
            userTasks.map(renderTask)
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור פעולה</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.type}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => { confirmAction?.fn(); setConfirmAction(null); }}>
              כן, בצע
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת משימה</DialogTitle>
          </DialogHeader>
          {editTask && renderTaskFormContent(
            "edit", editTitle, setEditTitle, editAssignedTo, setEditAssignedTo,
            editUrgency, setEditUrgency, editImportant, setEditImportant,
            editReminder, setEditReminder, editColor, setEditColor,
            editIsRecurring, setEditIsRecurring, editRecurrenceDay, setEditRecurrenceDay,
            () => withConfirm("האם את/ה בטוח/ה שברצונך לשמור שינויים?", () => editMutation.mutate()),
            editMutation.isPending,
            true,
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <StickyNote className="h-6 w-6" />
            לוח משימות אישי
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {USERS.map((u) => u.name).join(" • ")}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי תיאור משימה..."
              className="h-8 w-56 text-xs pr-8"
              dir="rtl"
            />
            <Filter className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {PERSONAL_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={showDone} onCheckedChange={setShowDone} id="show-done" />
            <Label htmlFor="show-done" className="text-sm">הצג שבוצעו</Label>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[...(currentUser ? [currentUser] : []), ...otherUsers].map((u) => {
          const counts = getStatusCounts(u.id);
          return (
            <Card key={u.id} className="p-3">
              <p className="text-sm font-semibold mb-1">{u.name}</p>
              <div className="flex gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground">סה״כ: <strong>{counts.total}</strong></span>
                {counts.in_progress > 0 && <span className="text-blue-600">בטיפול: {counts.in_progress}</span>}
                {counts.follow_up > 0 && <span className="text-yellow-600">מעקב: {counts.follow_up}</span>}
                {counts.not_done > 0 && <span className="text-red-600">לא בוצע: {counts.not_done}</span>}
                {counts.done > 0 && <span className="text-green-600">בוצע: {counts.done}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4`}>
          {currentUser && renderUserBoard(currentUser.id, currentUser.name, true)}
          {otherUsers.map((u) => renderUserBoard(u.id, u.name, false))}
        </div>
      )}

      <TeamTasksSection />
    </div>
  );
}
