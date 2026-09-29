import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Badge } from "@/employees/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Switch } from "@/employees/components/ui/switch";
import { Label } from "@/employees/components/ui/label";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Plus, Search, Download, MapPin, Clock, AlertTriangle, FileDown, Send, Loader2, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTrafficLight } from "@/employees/lib/trafficLight";
import { NewTaskDialog } from "@/employees/components/NewTaskDialog";
import { EditTaskDialog } from "@/employees/components/EditTaskDialog";
import { useIsMobile } from "@/employees/hooks/use-mobile";
import { generateTaskPdf, markTasksSentToClient } from "@/employees/lib/pdfReport";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { differenceInDays, parseISO, format } from "date-fns";

const frequencyLabels: Record<string, string> = {
  one_time: "חד פעמי",
  monthly: "חודשי",
  quarterly: "רבעוני",
};

const statusLabels: Record<string, string> = {
  pending: "ממתין",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

export default function AdminTasks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterExecutor, setFilterExecutor] = useState("all");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includePhotos, setIncludePhotos] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [editingSidesId, setEditingSidesId] = useState<string | null>(null);
  const [editingSidesValue, setEditingSidesValue] = useState("");
  const sidesInputRef = useRef<HTMLInputElement>(null);

  // Inline editing for prices
  const [editingField, setEditingField] = useState<{ id: string; field: "total_client_price" | "total_contractor_price" } | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSidesId && sidesInputRef.current) {
      sidesInputRef.current.focus();
      sidesInputRef.current.select();
    }
  }, [editingSidesId]);

  useEffect(() => {
    if (editingField && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingField]);

  const handleSaveSides = async (taskId: string) => {
    const val = parseInt(editingSidesValue, 10);
    if (isNaN(val) || val < 0) {
      setEditingSidesId(null);
      return;
    }
    const { error } = await supabase.from("tasks").update({ sides_required: val }).eq("id", taskId);
    if (error) {
      toast.error("שגיאה בשמירת צדדים");
    } else {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    setEditingSidesId(null);
  };

  const handleSavePrice = async () => {
    if (!editingField) return;
    const val = editingFieldValue.trim() === "" ? null : parseFloat(editingFieldValue);
    if (val !== null && isNaN(val)) {
      setEditingField(null);
      return;
    }
    const updateData = editingField.field === "total_client_price" 
      ? { total_client_price: val } 
      : { total_contractor_price: val };
    const { error } = await supabase.from("tasks").update(updateData).eq("id", editingField.id);
    if (error) {
      toast.error("שגיאה בשמירת מחיר");
    } else {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    setEditingField(null);
  };
  const [recipientEmail, setRecipientEmail] = useState("");

  // Query previously used recipient emails
  const { data: previousEmails = [] } = useQuery({
    queryKey: ["sent-emails"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("sent_to_email")
        .not("sent_to_email", "is", null)
        .order("updated_at", { ascending: false });
      const unique = [...new Set((data || []).map((d: any) => d.sent_to_email).filter(Boolean))];
      return unique as string[];
    },
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSent, setFilterSent] = useState("all");
  const [filterSides, setFilterSides] = useState("all");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, branches(id, name, city, network_id, networks(id, name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
  });

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return "—";
    const p = profiles.find((p: any) => p.user_id === userId);
    return p?.full_name || "—";
  };

  const executors = [...new Set(tasks.map((t: any) => t.executor).filter(Boolean))];
  const networks = [...new Set(tasks.map((t: any) => t.branches?.networks?.name).filter(Boolean))];
  const statuses = [...new Set(tasks.map((t: any) => t.status).filter(Boolean))];

  const filtered = tasks.filter((t: any) => {
    if (search) {
      const q = search.toLowerCase();
      const networkName = (t.branches?.networks?.name || "").toLowerCase();
      const branchName = (t.branches?.name || "").toLowerCase();
      const city = (t.branches?.city || "").toLowerCase();
      const workType = (t.work_type || "").toLowerCase();
      const freq = (frequencyLabels[t.frequency] || t.frequency || "").toLowerCase();
      const sides = String(t.sides_required ?? "");
      const executor = (t.executor || "").toLowerCase();
      const status = (statusLabels[t.status] || t.status || "").toLowerCase();
      if (
        !networkName.includes(q) &&
        !branchName.includes(q) &&
        !city.includes(q) &&
        !workType.includes(q) &&
        !freq.includes(q) &&
        !sides.includes(q) &&
        !executor.includes(q) &&
        !status.includes(q)
      ) return false;
    }
    if (filterExecutor !== "all" && (t.executor || "") !== filterExecutor) return false;
    if (filterNetwork !== "all" && (t.branches?.networks?.name || "") !== filterNetwork) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (dateFrom && t.due_date && t.due_date < dateFrom) return false;
    if (dateTo && t.due_date && t.due_date > dateTo) return false;
    if ((dateFrom || dateTo) && !t.due_date) return false;
    if (filterSent === "sent" && !t.sent_to_client_at) return false;
    if (filterSent === "not_sent" && t.sent_to_client_at) return false;
    if (filterSides !== "all" && t.sides_required !== parseInt(filterSides, 10)) return false;
    return true;
  });

  const numericCols = new Set(["sides", "client_price", "contractor_price"]);

  const sorted = [...filtered].sort((a: any, b: any) => {
    const aPinned = a.frequency === "one_time" && !a.due_date ? 1 : 0;
    const bPinned = b.frequency === "one_time" && !b.due_date ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    if (sortCol) {
      const getVal = (t: any): string | number => {
        switch (sortCol) {
          case "network": return t.branches?.networks?.name || "";
          case "city": return t.branches?.city || "";
          case "branch": return t.branches?.name || "";
          case "work_type": return t.work_type || "";
          case "frequency": return t.frequency || "";
          case "sides": return t.sides_required ?? 0;
          case "client_price": return t.total_client_price ?? 0;
          case "contractor_price": return t.total_contractor_price ?? 0;
          case "executor": return getAssigneeName(t.assigned_to);
          case "due_date": return t.due_date || "";
          case "status": return t.status || "";
          default: return "";
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      let cmp: number;
      if (numericCols.has(sortCol)) {
        cmp = (va as number) - (vb as number);
      } else {
        cmp = String(va).localeCompare(String(vb), "he");
      }
      return sortDir === "asc" ? cmp : -cmp;
    }
    return 0;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col: string) =>
    sortCol === col
      ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
      : <ArrowUpDown className="h-3 w-3 opacity-30" />;

  const getOverdueDays = (t: any) => {
    if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return 0;
    const days = differenceInDays(new Date(), parseISO(t.due_date));
    return days > 0 ? days : 0;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((t: any) => t.id)));
    }
  };

  const selectedTasks = sorted.filter((t: any) => selectedIds.has(t.id));

  const handleClearSentStatus = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from("tasks").update({ sent_to_client_at: null } as any).eq("id", taskId);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("סימון 'נשלח ללקוח' בוטל");
    } catch {
      toast.error("שגיאה בביטול הסימון");
    }
  };

  const handleDownloadPdf = async () => {
    if (selectedTasks.length === 0) {
      toast.error("יש לבחור משימות לפני ייצוא");
      return;
    }
    setGenerating(true);
    try {
      const blob = await generateTaskPdf(selectedTasks, includePhotos);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedTasks.length === 1
        ? `field_report_${selectedTasks[0].branches?.networks?.name}_${selectedTasks[0].branches?.name}.pdf`
        : `yarok360_reports_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("הדוח הורד בהצלחה");
    } catch (e: any) {
      toast.error("שגיאה ביצירת ה-PDF: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReport = async () => {
    if (!recipientEmail.trim()) {
      toast.error("יש להזין אימייל נמען");
      return;
    }
    setSendingReport(true);
    try {
      // 1. Generate the PDF
      toast.info("מייצר PDF...");
      const blob = await generateTaskPdf(selectedTasks, includePhotos);

      // 2. Upload PDF to storage
      const fileName = `task_reports/${format(new Date(), "yyyyMMdd_HHmmss")}_${crypto.randomUUID().slice(0, 8)}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("field-media")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error("שגיאה בהעלאת PDF: " + uploadError.message);

      // 3. Email the report with the PDF attached
      const { data, error } = await supabase.functions.invoke("send-task-report", {
        body: { taskIds: selectedTasks.map((t: any) => t.id), pdfPath: fileName, recipientEmail: recipientEmail.trim() },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
      // 4. Save email to tasks
      if (recipientEmail.trim()) {
        await supabase
          .from("tasks")
          .update({ sent_to_email: recipientEmail.trim() } as any)
          .in("id", selectedTasks.map((t: any) => t.id));
      }
      await markTasksSentToClient(selectedTasks.map((t: any) => t.id));
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["sent-emails"] });
      toast.success(`הדוח נשלח במייל ל-${recipientEmail.trim()}`);
      setSendDialogOpen(false);
    } catch (e: any) {
      toast.error("שגיאה בשליחה: " + e.message);
    } finally {
      setSendingReport(false);
    }
  };

  const handleExport = () => {
    const rows = sorted.map((t: any) => ({
      "רשת": t.branches?.networks?.name || "",
      "סניף": t.branches?.name || "",
      "גורם מבצע": t.executor || "",
      "סוג עבודה": t.work_type,
      "תדירות": frequencyLabels[t.frequency] || t.frequency,
      "צדדים": t.sides_required > 0 ? t.sides_required : "",
      "מחיר ללקוח": t.total_client_price || "",
      "מחיר לקבלן": t.total_contractor_price || "",
      "מבצע": getAssigneeName(t.assigned_to),
      "תאריך יעד": t.due_date || "",
      "סטטוס": statusLabels[t.status] || t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משימות");
    XLSX.writeFile(wb, "yarok360_tasks.xlsx");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">משימות</h1>
            <p className="text-muted-foreground text-sm mt-1">ניהול ומעקב אחר כל משימות השטח</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExport} disabled={sorted.length === 0} size={isMobile ? "sm" : "default"}>
              <Download className="h-4 w-4 ml-2" />
              {isMobile ? `אקסל` : `ייצוא לאקסל (${sorted.length})`}
            </Button>
            <Button className="gradient-primary text-primary-foreground" onClick={() => setDialogOpen(true)} size={isMobile ? "sm" : "default"}>
              <Plus className="h-4 w-4 ml-2" />
              משימה חדשה
            </Button>
          </div>
        </div>

        <NewTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        {editTask && <EditTaskDialog task={editTask} open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)} />}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש משימות..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterExecutor} onValueChange={setFilterExecutor}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="מבצע" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המבצעים</SelectItem>
              {executors.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterNetwork} onValueChange={setFilterNetwork}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="רשת" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הרשתות</SelectItem>
              {networks.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterSent} onValueChange={setFilterSent}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="שליחה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="sent">נשלח</SelectItem>
              <SelectItem value="not_sent">לא נשלח</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSides} onValueChange={setFilterSides}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="צדדים" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הצדדים</SelectItem>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">מתאריך</Label>
            <Input type="date" className="w-[150px]" dir="ltr" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">עד תאריך</Label>
            <Input type="date" className="w-[150px]" dir="ltr" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterExecutor("all");
              setFilterNetwork("all");
              setFilterStatus("all");
              setFilterSent("all");
              setFilterSides("all");
              setDateFrom("");
              setDateTo("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            איפוס סינון
          </Button>
        </div>

        {/* Selection toolbar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedIds.size} משימות נבחרו</span>
              <div className="flex items-center gap-2">
                <Switch id="include-photos" checked={includePhotos} onCheckedChange={setIncludePhotos} />
                <Label htmlFor="include-photos" className="text-sm">כלול תמונות בדוח</Label>
              </div>
              <Button size="sm" onClick={handleDownloadPdf} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                הורד PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSendDialogOpen(true)} className="gap-2">
                <Send className="h-4 w-4" />
                שלח ללקוח
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Send report by email */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>שליחה ללקוח</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>אימייל הנמען</Label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  dir="ltr"
                  list="previous-emails"
                />
                {previousEmails.length > 0 && (
                  <datalist id="previous-emails">
                    {previousEmails.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                )}
              </div>
              <Button onClick={handleSendReport} disabled={sendingReport} className="w-full gap-2">
                {sendingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                שלח
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mobile: Card layout */}
        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">טוען...</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">אין משימות עדיין.</div>
            ) : sorted.map((t: any) => {
              const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
              const overdueDays = getOverdueDays(t);
              const isPinned = t.frequency === "one_time" && !t.due_date;
              const isSelected = selectedIds.has(t.id);
              return (
                <Card key={t.id} className={`shadow-card transition-shadow ${isSelected ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(t.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 cursor-pointer" onClick={() => setEditTask(t)}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{t.branches?.networks?.name || "—"}</h3>
                            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{t.branches?.name || "—"}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={traffic.className}>{traffic.label}</Badge>
                            {isPinned && <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">📌 מוצמד</Badge>}
                            {(t as any).sent_to_client_at && (
                              <Badge
                                variant="outline"
                                className="text-xs border-emerald-400 text-emerald-600 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive gap-0.5"
                                onClick={(e) => handleClearSentStatus(t.id, e)}
                                title="לחץ לביטול סימון נשלח"
                              >
                                נשלח ללקוח <X className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground mb-1">{t.work_type}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          <span>תדירות: {frequencyLabels[t.frequency] || t.frequency}</span>
                          <span>צדדים: {t.sides_required}</span>
                          <span>מבצע: {getAssigneeName(t.assigned_to)}</span>
                          {t.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {t.due_date}
                            </span>
                          )}
                        </div>
                        {overdueDays > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-destructive text-xs font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>באיחור {overdueDays} ימים</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Desktop: Table layout */
          <div className="bg-card rounded-lg border shadow-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={sorted.length > 0 && selectedIds.size === sorted.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("network")}>
                    <span className="flex items-center gap-1">רשת {sortIcon("network")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("city")}>
                    <span className="flex items-center gap-1">עיר {sortIcon("city")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("branch")}>
                    <span className="flex items-center gap-1">סניף {sortIcon("branch")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("work_type")}>
                    <span className="flex items-center gap-1">סוג עבודה {sortIcon("work_type")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("frequency")}>
                    <span className="flex items-center gap-1">תדירות {sortIcon("frequency")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("sides")}>
                    <span className="flex items-center gap-1">צדדים {sortIcon("sides")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("client_price")}>
                    <span className="flex items-center gap-1">מחיר ללקוח {sortIcon("client_price")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("contractor_price")}>
                    <span className="flex items-center gap-1">מחיר לקבלן {sortIcon("contractor_price")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("executor")}>
                    <span className="flex items-center gap-1">מבצע {sortIcon("executor")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("due_date")}>
                    <span className="flex items-center gap-1">תאריך יעד {sortIcon("due_date")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort("status")}>
                    <span className="flex items-center gap-1">סטטוס {sortIcon("status")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">טוען...</TableCell>
                  </TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      אין משימות עדיין. ייבא נתונים או צור משימה חדשה.
                    </TableCell>
                  </TableRow>
                ) : sorted.map((t: any) => {
                  const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
                  const overdueDays = getOverdueDays(t);
                  const isPinned = t.frequency === "one_time" && !t.due_date;
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <TableRow key={t.id} className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(t.id)} />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => setEditTask(t)}>
                        {isPinned && <span title="מוצמד">📌 </span>}
                        {t.branches?.networks?.name || "—"}
                      </TableCell>
                      <TableCell onClick={() => setEditTask(t)}>{t.branches?.city || "—"}</TableCell>
                      <TableCell onClick={() => setEditTask(t)}>{t.branches?.name || "—"}</TableCell>
                      <TableCell onClick={() => setEditTask(t)}>{t.work_type}</TableCell>
                      <TableCell onClick={() => setEditTask(t)}>{frequencyLabels[t.frequency] || t.frequency}</TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSidesId(t.id);
                          setEditingSidesValue(String(t.sides_required ?? 0));
                        }}
                      >
                        {editingSidesId === t.id ? (
                          <input
                            ref={sidesInputRef}
                            type="number"
                            min={0}
                            className="w-14 h-7 text-center rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={editingSidesValue}
                            onChange={(e) => setEditingSidesValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveSides(t.id);
                              if (e.key === "Escape") setEditingSidesId(null);
                            }}
                            onBlur={() => handleSaveSides(t.id)}
                          />
                        ) : (
                          t.sides_required
                        )}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField({ id: t.id, field: "total_client_price" });
                          setEditingFieldValue(String(t.total_client_price ?? ""));
                        }}
                      >
                        {editingField?.id === t.id && editingField.field === "total_client_price" ? (
                          <input
                            ref={priceInputRef}
                            type="number"
                            className="w-20 h-7 text-center rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice();
                              if (e.key === "Escape") setEditingField(null);
                            }}
                            onBlur={() => handleSavePrice()}
                          />
                        ) : (
                          t.total_client_price ? `₪${t.total_client_price}` : "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField({ id: t.id, field: "total_contractor_price" });
                          setEditingFieldValue(String(t.total_contractor_price ?? ""));
                        }}
                      >
                        {editingField?.id === t.id && editingField.field === "total_contractor_price" ? (
                          <input
                            ref={priceInputRef}
                            type="number"
                            className="w-20 h-7 text-center rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice();
                              if (e.key === "Escape") setEditingField(null);
                            }}
                            onBlur={() => handleSavePrice()}
                          />
                        ) : (
                          t.total_contractor_price ? `₪${t.total_contractor_price}` : "—"
                        )}
                      </TableCell>
                      <TableCell onClick={() => setEditTask(t)}>{getAssigneeName(t.assigned_to)}</TableCell>
                      <TableCell onClick={() => setEditTask(t)}>
                        {t.due_date || "—"}
                        {overdueDays > 0 && (
                          <span className="text-destructive text-xs mr-1">({overdueDays} ימים)</span>
                        )}
                      </TableCell>
                      <TableCell onClick={() => setEditTask(t)}>
                        <div className="flex items-center gap-1">
                          <Badge className={traffic.className}>{traffic.label}</Badge>
                          {(t as any).sent_to_client_at && (
                            <Badge
                              variant="outline"
                              className="text-xs border-emerald-400 text-emerald-600 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive gap-0.5"
                              onClick={(e) => handleClearSentStatus(t.id, e)}
                              title="לחץ לביטול סימון נשלח"
                            >
                              נשלח <X className="h-3 w-3" />
                            </Badge>
                          )}
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
    </AdminLayout>
  );
}
