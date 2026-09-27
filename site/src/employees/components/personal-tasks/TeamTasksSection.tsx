import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Textarea } from "@/employees/components/ui/textarea";
import { Label } from "@/employees/components/ui/label";
import { Badge } from "@/employees/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/employees/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/employees/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { ReminderPicker, parseReminderLabel } from "./ReminderPicker";
import { Plus, Pencil, Trash2, Users, Search, Filter } from "lucide-react";
import { toast } from "sonner";

type EmployeeSuggestion = { name: string; phone: string | null };

type TeamTask = {
  id: string;
  employee_name: string;
  employee_phone: string | null;
  task_description: string;
  creator_role: string;
  status: string;
  reminder_frequency: string | null;
  last_reminder_sent: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "in_progress", label: "בטיפול", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "done", label: "בוצע", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "not_done", label: "לא בוצע", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "follow_up", label: "בהמשך מעקב", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
];

const CREATOR_OPTIONS = [
  { value: "uzi", label: "עוזי זלכה" },
  { value: "maya", label: "מאיה קורן" },
  { value: "orit", label: "אורית עדן" },
];

function EmployeeAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: EmployeeSuggestion) => void;
  suggestions: EmployeeSuggestion[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions;
    const q = value.trim().toLowerCase();
    return suggestions.filter((s) => s.name.toLowerCase().includes(q));
  }, [value, suggestions]);

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="שם מלא — הקלד או בחר מהרשימה"
        dir="rtl"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center"
              onClick={() => { onSelect(s); setOpen(false); }}
            >
              <span>{s.name}</span>
              {s.phone && <span className="text-xs text-muted-foreground" dir="ltr">{s.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamTasksSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<TeamTask | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; fn: () => void } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCreator, setFormCreator] = useState("uzi");
  const [formReminder, setFormReminder] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCreator, setEditCreator] = useState("uzi");
  const [editStatus, setEditStatus] = useState("in_progress");
  const [editReminder, setEditReminder] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCreator, setFilterCreator] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["team-tasks-board"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_tasks" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TeamTask[];
    },
    enabled: !!user,
  });

  // Fetch all profiles + past team task employees for autocomplete
  const { data: employeeSuggestions = [] } = useQuery({
    queryKey: ["employee-suggestions"],
    queryFn: async () => {
      const map = new Map<string, EmployeeSuggestion>();
      // Profiles
      const { data: profiles } = await supabase.from("profiles").select("full_name, phone");
      (profiles || []).forEach((p: any) => {
        if (p.full_name) map.set(p.full_name, { name: p.full_name, phone: p.phone });
      });
      // Past team tasks
      const { data: pastTasks } = await supabase
        .from("team_tasks" as any)
        .select("employee_name, employee_phone");
      ((pastTasks || []) as any[]).forEach((t) => {
        if (t.employee_name && !map.has(t.employee_name)) {
          map.set(t.employee_name, { name: t.employee_name, phone: t.employee_phone });
        }
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_tasks" as any).insert({
        employee_name: formName.trim(),
        employee_phone: formPhone.trim() || null,
        task_description: formDesc.trim(),
        creator_role: formCreator,
        reminder_frequency: formReminder,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks-board"] });
      resetForm();
      setAddOpen(false);
      toast.success("משימה נוספה בהצלחה");
    },
    onError: () => toast.error("שגיאה בהוספת משימה"),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editTask) return;
      const isDone = editStatus === "done";
      const { error } = await supabase
        .from("team_tasks" as any)
        .update({
          employee_name: editName.trim(),
          employee_phone: editPhone.trim() || null,
          task_description: editDesc.trim(),
          creator_role: editCreator,
          status: editStatus,
          reminder_frequency: isDone ? null : editReminder,
        } as any)
        .eq("id", editTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks-board"] });
      setEditTask(null);
      toast.success("משימה עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון משימה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks-board"] });
      toast.success("משימה נמחקה");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const isDone = status === "done";
      const update: any = { status };
      if (isDone) update.reminder_frequency = null;
      const { error } = await supabase
        .from("team_tasks" as any)
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-tasks-board"] }),
  });

  const resetForm = () => {
    setFormName(""); setFormPhone(""); setFormDesc(""); setFormCreator("uzi"); setFormReminder(null);
  };

  const openEdit = (t: TeamTask) => {
    setEditTask(t);
    setEditName(t.employee_name);
    setEditPhone(t.employee_phone || "");
    setEditDesc(t.task_description);
    setEditCreator(t.creator_role);
    setEditStatus(t.status);
    setEditReminder(t.reminder_frequency);
  };

  const withConfirm = (msg: string, fn: () => void) => setConfirmAction({ type: msg, fn });

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus);
    if (filterCreator !== "all") list = list.filter((t) => t.creator_role === filterCreator);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) =>
        t.employee_name.toLowerCase().includes(q) ||
        t.task_description.toLowerCase().includes(q)
      );
    }

    // Done tasks go to bottom with dimmed appearance
    list.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [tasks, filterStatus, filterCreator, searchQuery]);

  const getStatusInfo = (status: string) => STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  const getCreatorLabel = (role: string) => CREATOR_OPTIONS.find((c) => c.value === role)?.label || role;

  const renderForm = (
    mode: "add" | "edit",
    name: string, setName: (v: string) => void,
    phone: string, setPhone: (v: string) => void,
    desc: string, setDesc: (v: string) => void,
    creator: string, setCreatorVal: (v: string) => void,
    reminder: string | null, setReminderVal: (v: string | null) => void,
    onSubmit: () => void,
    isPending: boolean,
    statusVal?: string, setStatusVal?: (v: string) => void,
  ) => (
    <div className="space-y-4" dir="rtl">
      <div>
        <Label>שם העובד</Label>
        <EmployeeAutocomplete
          value={name}
          onChange={setName}
          onSelect={(s) => { setName(s.name); if (s.phone && !phone) setPhone(s.phone); }}
          suggestions={employeeSuggestions}
        />
      </div>
      <div>
        <Label>טלפון</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" dir="ltr" type="tel" />
      </div>
      <div>
        <Label>תיאור המשימה</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="פירוט המשימה..." dir="rtl" rows={3} />
      </div>
      <div>
        <Label>מי הזין</Label>
        <Select value={creator} onValueChange={setCreatorVal}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CREATOR_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mode === "edit" && setStatusVal && (
        <div>
          <Label>סטטוס</Label>
          <Select value={statusVal} onValueChange={setStatusVal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {(mode === "add" || (statusVal && statusVal !== "done")) && (
        <div>
          <Label className="mb-2 block">תזכורות WhatsApp 🔔</Label>
          <ReminderPicker value={reminder} onChange={setReminderVal} />
        </div>
      )}
      {mode === "edit" && statusVal === "done" && (
        <p className="text-sm text-muted-foreground">⚠️ משימה שסטטוס שלה "בוצע" — התזכורות מושבתות אוטומטית.</p>
      )}
      <Button
        className="w-full"
        disabled={!name.trim() || !desc.trim() || isPending}
        onClick={onSubmit}
      >
        {isPending ? "שומר..." : mode === "add" ? "הזן משימה" : "שמור שינויים"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 mt-8">
      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור פעולה</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.type}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => { confirmAction?.fn(); setConfirmAction(null); }}>כן, בצע</AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>עריכת משימה</DialogTitle></DialogHeader>
          {editTask && renderForm(
            "edit", editName, setEditName, editPhone, setEditPhone, editDesc, setEditDesc,
            editCreator, setEditCreator, editReminder, setEditReminder,
            () => withConfirm("האם את/ה בטוח/ה שברצונך לשמור שינויים?", () => editMutation.mutate()),
            editMutation.isPending, editStatus, setEditStatus,
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" />
          מעקב משימות עובדים
        </h2>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              הזנת משימה לעובד
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader><DialogTitle>הזנת משימה לעובד</DialogTitle></DialogHeader>
            {renderForm(
              "add", formName, setFormName, formPhone, setFormPhone, formDesc, setFormDesc,
              formCreator, setFormCreator, formReminder, setFormReminder,
              () => addMutation.mutate(), addMutation.isPending,
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-3 rounded-lg border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי שם עובד או תיאור..."
            className="pr-10 h-9 text-sm"
            dir="rtl"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCreator} onValueChange={setFilterCreator}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="מזין" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המזינים</SelectItem>
            {CREATOR_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-muted-foreground font-medium text-sm">
            {searchQuery || filterStatus !== "all" || filterCreator !== "all"
              ? "לא נמצאו תוצאות לפי הסינון"
              : "אין משימות עובדים — לחץ על 'הזנת משימה לעובד' להתחלה"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם עובד</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>מזין</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תזכורת</TableHead>
                <TableHead className="w-[100px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((t) => {
                const isDone = t.status === "done";
                const statusInfo = getStatusInfo(t.status);
                return (
                  <TableRow key={t.id} className={isDone ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div>
                        <span>{t.employee_name}</span>
                        {t.employee_phone && (
                          <p className="text-xs text-muted-foreground" dir="ltr">{t.employee_phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-sm truncate" title={t.task_description}>{t.task_description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getCreatorLabel(t.creator_role)}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          withConfirm(`לשנות סטטוס ל"${getStatusInfo(v).label}"?`, () =>
                            updateStatus.mutate({ id: t.id, status: v })
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs border-0 p-0">
                          <Badge variant="outline" className={`${statusInfo.color} text-xs`}>
                            {statusInfo.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isDone ? (
                        <span className="text-xs text-muted-foreground">מושבת</span>
                      ) : (
                        <span className="text-xs">{parseReminderLabel(t.reminder_frequency)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => withConfirm("האם את/ה בטוח/ה שברצונך למחוק משימה זו?", () => deleteMutation.mutate(t.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
