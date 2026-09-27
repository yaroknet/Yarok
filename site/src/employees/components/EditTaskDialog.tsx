import { useState } from "react";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Switch } from "@/employees/components/ui/switch";
import { Textarea } from "@/employees/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/employees/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/employees/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/employees/components/ui/command";
import { Calendar } from "@/employees/components/ui/calendar";
import { Trash2, FileText, Pencil, CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/employees/lib/utils";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import { FieldReportViewer } from "@/employees/components/FieldReportViewer";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const WORK_TYPES = [
  "ויטרינות", "גובה", "רבעוני", "רבעוני סופר פארם", "ניקיון יסודי אחרי שיפוץ",
  "גובה חודשי קסטרו", "שילוט", "הסרת מדבקה מויטרינה + ניקיון ויטרינה",
  "תגבור", "אספקת כח אדם", "אחר",
];
const SIDES_WORK_TYPES = ["ויטרינות", "הסרת מדבקה מויטרינה + ניקיון ויטרינה"];

interface Props {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const hasSpecificDates = Array.isArray(task.specific_dates) && task.specific_dates.length > 0;
  const hasRange = task.start_date && task.end_date;
  const initialDateMode = hasSpecificDates ? "specific" : hasRange ? "range" : "single";

  const [form, setForm] = useState(() => ({
    network_id: task.branches?.network_id || "",
    branch_id: task.branch_id || "",
    work_type: WORK_TYPES.includes(task.work_type) ? task.work_type : "אחר",
    custom_work_type: WORK_TYPES.includes(task.work_type) ? "" : task.work_type,
    frequency: task.frequency || "one_time",
    sides_required: task.sides_required || 1,
    total_client_price: task.total_client_price?.toString() || "",
    total_contractor_price: task.total_contractor_price?.toString() || "",
    assigned_to: task.assigned_to || "",
    due_date: task.due_date || "",
    requires_photo: task.requires_photo || false,
    requires_video: task.requires_video || false,
    admin_notes: task.admin_notes || "",
    status: task.status || "pending",
  }));

  const [dateMode, setDateMode] = useState<"single" | "range" | "specific">(initialDateMode);
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(task.start_date ? new Date(task.start_date) : undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(task.end_date ? new Date(task.end_date) : undefined);
  const [specificDates, setSpecificDates] = useState<Date[]>(
    hasSpecificDates ? task.specific_dates.map((date: string) => new Date(`${date}T12:00:00`)) : []
  );
  const [showDueDateCal, setShowDueDateCal] = useState(false);
  const [showRangeFromCal, setShowRangeFromCal] = useState(false);
  const [showRangeToCal, setShowRangeToCal] = useState(false);

  const [networkOpen, setNetworkOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [networkSearch, setNetworkSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>(task.branches?.city || "");

  const { data: networks = [] } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data } = await supabase.from("networks").select("id, name");
      return data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", form.network_id],
    queryFn: async () => {
      if (!form.network_id) return [];
      const { data } = await supabase.from("branches").select("id, name, city").eq("network_id", form.network_id);
      return data || [];
    },
    enabled: !!form.network_id,
  });

  const { data: teamLeaders = [] } = useQuery({
    queryKey: ["all-users-select"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      if (!roles?.length) return [];
      const uniqueUserIds = [...new Set(roles.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uniqueUserIds);
      return profiles || [];
    },
  });

  const uniqueCities = [...new Set(branches.filter((b: any) => b.city).map((b: any) => b.city as string))].sort((a, b) => a.localeCompare(b, "he"));
  const filteredBranches = selectedCity ? branches.filter((b: any) => b.city === selectedCity) : branches;
  const selectedNetwork = networks.find((n: any) => n.id === form.network_id);
  const selectedBranch = branches.find((b: any) => b.id === form.branch_id);

  const updateTask = useMutation({
    mutationFn: async () => {
      const workType = form.work_type === "אחר" ? form.custom_work_type : form.work_type;
      if (!workType) throw new Error("סוג עבודה הוא שדה חובה");
      if (!form.branch_id) throw new Error("יש לבחור סניף");
      const selectedLeader = teamLeaders.find((tl: any) => tl.user_id === form.assigned_to);

      let dueDate: string | null = null;
      let startDate: string | null = null;
      let endDate: string | null = null;
      let specificDatesPayload: string[] | null = null;

      if (dateMode === "single") {
        dueDate = form.due_date || null;
      } else if (dateMode === "range") {
        startDate = rangeFrom ? format(rangeFrom, "yyyy-MM-dd") : null;
        endDate = rangeTo ? format(rangeTo, "yyyy-MM-dd") : null;
        dueDate = endDate;
      } else if (dateMode === "specific") {
        const sorted = [...specificDates].sort((a, b) => a.getTime() - b.getTime());
        specificDatesPayload = sorted.map((date) => format(date, "yyyy-MM-dd"));
        startDate = specificDatesPayload[0] || null;
        endDate = specificDatesPayload[specificDatesPayload.length - 1] || null;
        dueDate = endDate;
      }

      const { error } = await supabase.from("tasks").update({
        branch_id: form.branch_id,
        work_type: workType,
        frequency: form.frequency,
        sides_required: SIDES_WORK_TYPES.includes(form.work_type) ? form.sides_required : 0,
        total_client_price: form.total_client_price ? parseFloat(form.total_client_price) : null,
        total_contractor_price: form.total_contractor_price ? parseFloat(form.total_contractor_price) : null,
        assigned_to: form.assigned_to || null,
        executor: selectedLeader?.full_name || null,
        due_date: dueDate,
        start_date: startDate,
        end_date: endDate,
        specific_dates: specificDatesPayload,
        requires_photo: form.requires_photo,
        requires_video: form.requires_video,
        is_recurring: form.frequency !== "one_time",
        admin_notes: form.admin_notes || null,
        status: form.status,
      } as any).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
      toast({ title: "המשימה עודכנה בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
      toast({ title: "המשימה נמחקה בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));
  const showSides = SIDES_WORK_TYPES.includes(form.work_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
        </DialogHeader>

        {/* Network, Branch & City (editable) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">רשת</Label>
            <Popover open={networkOpen} onOpenChange={setNetworkOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
                  {selectedNetwork?.name || task.branches?.networks?.name || "בחר רשת"}
                  <ChevronsUpDown className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="חפש או צור רשת..." value={networkSearch} onValueChange={setNetworkSearch} />
                  <CommandList>
                    <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                    <CommandGroup>
                      {networkSearch.trim() && !networks.some((n: any) => n.name.toLowerCase() === networkSearch.trim().toLowerCase()) && (
                        <CommandItem value={`__create_network_${networkSearch.trim()}`} onSelect={async () => {
                          try {
                            const { data, error } = await supabase.from("networks").insert({ name: networkSearch.trim() }).select("id").single();
                            if (error) throw error;
                            qc.invalidateQueries({ queryKey: ["networks"] });
                            set("network_id", data.id); set("branch_id", ""); setSelectedCity(""); setNetworkOpen(false); setNetworkSearch("");
                          } catch { toast({ title: "שגיאה ביצירת רשת", variant: "destructive" }); }
                        }}>
                          + צור רשת "{networkSearch.trim()}"
                        </CommandItem>
                      )}
                      {networks.map((n: any) => (
                        <CommandItem key={n.id} value={n.name} onSelect={() => {
                          set("network_id", n.id); set("branch_id", ""); setSelectedCity(""); setNetworkOpen(false); setNetworkSearch("");
                        }}>
                          <Check className={cn("ml-2 h-4 w-4", form.network_id === n.id ? "opacity-100" : "opacity-0")} />
                          {n.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {/* City */}
          <div className="space-y-2">
            <Label className="text-xs">עיר</Label>
            <Popover open={cityOpen} onOpenChange={setCityOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm" disabled={!form.network_id}>
                  {selectedCity || task.branches?.city || "בחר עיר"}
                  <ChevronsUpDown className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="חפש או הקלד עיר..." value={citySearch} onValueChange={setCitySearch} />
                  <CommandList>
                    <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                    <CommandGroup>
                      {citySearch.trim() && !uniqueCities.some((c: string) => c.toLowerCase() === citySearch.trim().toLowerCase()) && (
                        <CommandItem value={`__create_city_${citySearch.trim()}`} onSelect={() => { setSelectedCity(citySearch.trim()); set("branch_id", ""); setCityOpen(false); setCitySearch(""); }}>
                          + השתמש בעיר "{citySearch.trim()}"
                        </CommandItem>
                      )}
                      <CommandItem value="__all__" onSelect={() => { setSelectedCity(""); setCityOpen(false); setCitySearch(""); }}>
                        <Check className={cn("ml-2 h-4 w-4", !selectedCity ? "opacity-100" : "opacity-0")} />
                        כל הערים
                      </CommandItem>
                      {uniqueCities.map((city) => (
                        <CommandItem key={city} value={city} onSelect={() => { setSelectedCity(city); set("branch_id", ""); setCityOpen(false); setCitySearch(""); }}>
                          <Check className={cn("ml-2 h-4 w-4", selectedCity === city ? "opacity-100" : "opacity-0")} />
                          {city}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {/* Branch */}
          <div className="space-y-2">
            <Label className="text-xs">סניף</Label>
            <Popover open={branchOpen} onOpenChange={setBranchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm" disabled={!form.network_id}>
                  {selectedBranch?.name || task.branches?.name || "בחר סניף"}
                  <ChevronsUpDown className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="חפש או צור סניף..." value={branchSearch} onValueChange={setBranchSearch} />
                  <CommandList>
                    <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                    <CommandGroup>
                      {branchSearch.trim() && !filteredBranches.some((b: any) => b.name.toLowerCase() === branchSearch.trim().toLowerCase()) && (
                        <CommandItem value={`__create_branch_${branchSearch.trim()}`} onSelect={async () => {
                          try {
                            const { data, error } = await supabase.from("branches").insert({ name: branchSearch.trim(), network_id: form.network_id, city: selectedCity || null }).select("id").single();
                            if (error) throw error;
                            qc.invalidateQueries({ queryKey: ["branches", form.network_id] });
                            set("branch_id", data.id); setBranchOpen(false); setBranchSearch("");
                          } catch { toast({ title: "שגיאה ביצירת סניף", variant: "destructive" }); }
                        }}>
                          + צור סניף "{branchSearch.trim()}"
                        </CommandItem>
                      )}
                      {filteredBranches.map((b: any) => (
                        <CommandItem key={b.id} value={b.name} onSelect={() => { set("branch_id", b.id); setBranchOpen(false); setBranchSearch(""); }}>
                          <Check className={cn("ml-2 h-4 w-4", form.branch_id === b.id ? "opacity-100" : "opacity-0")} />
                          {b.name} {b.city ? `(${b.city})` : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="edit" className="gap-1">
              <Pencil className="h-3.5 w-3.5" />
              עריכת משימה
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1">
              <FileText className="h-3.5 w-3.5" />
              דיווח שטח
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4">
            <form onSubmit={(e) => { e.preventDefault(); updateTask.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>סוג עבודה *</Label>
                <Select value={form.work_type} onValueChange={(v) => set("work_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map((wt) => <SelectItem key={wt} value={wt}>{wt}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.work_type === "אחר" && (
                  <Input value={form.custom_work_type} onChange={(e) => set("custom_work_type", e.target.value)} placeholder="הזן סוג עבודה" required />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תדירות *</Label>
                  <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">חד פעמי</SelectItem>
                      <SelectItem value="monthly">חודשי</SelectItem>
                      <SelectItem value="quarterly">רבעוני</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showSides && (
                  <div className="space-y-2">
                    <Label>צדדים נדרשים</Label>
                    <Input type="number" min={1} value={form.sides_required} onChange={(e) => set("sides_required", parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>מחיר ללקוח (₪)</Label>
                  <Input type="number" step="0.01" value={form.total_client_price} onChange={(e) => set("total_client_price", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>מחיר לקבלן (₪)</Label>
                  <Input type="number" step="0.01" value={form.total_contractor_price} onChange={(e) => set("total_contractor_price", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>מבצע *</Label>
                <Select value={form.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
                  <SelectTrigger><SelectValue placeholder="לא משויך" /></SelectTrigger>
                  <SelectContent>
                    {teamLeaders.map((tl: any) => <SelectItem key={tl.user_id} value={tl.user_id}>{tl.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Section */}
              <div className="space-y-3">
                <Label>תאריכים</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={dateMode === "single" ? "default" : "outline"} size="sm" onClick={() => setDateMode("single")}>
                    יום ספציפי
                  </Button>
                  <Button type="button" variant={dateMode === "range" ? "default" : "outline"} size="sm" onClick={() => setDateMode("range")}>
                    טווח תאריכים
                  </Button>
                  <Button type="button" variant={dateMode === "specific" ? "default" : "outline"} size="sm" onClick={() => setDateMode("specific")}>
                    בחירה חופשית
                  </Button>
                </div>

                {dateMode === "single" && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-right font-normal", !form.due_date && "text-muted-foreground")}
                      onClick={() => setShowDueDateCal((v) => !v)}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {form.due_date ? format(new Date(form.due_date), "dd/MM/yyyy", { locale: he }) : "בחר תאריך יעד"}
                    </Button>
                    {showDueDateCal && (
                      <Calendar
                        mode="single"
                        selected={form.due_date ? new Date(`${form.due_date}T12:00:00`) : undefined}
                        onSelect={(date) => { set("due_date", date ? format(date, "yyyy-MM-dd") : ""); setShowDueDateCal(false); }}
                        locale={he}
                        className={cn("p-3 pointer-events-auto rounded-lg border")}
                      />
                    )}
                  </div>
                )}

                {dateMode === "range" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">מתאריך</Label>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("w-full justify-start text-right font-normal text-sm", !rangeFrom && "text-muted-foreground")}
                          onClick={() => { setShowRangeFromCal((v) => !v); setShowRangeToCal(false); }}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {rangeFrom ? format(rangeFrom, "dd/MM/yyyy", { locale: he }) : "התחלה"}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">עד תאריך</Label>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("w-full justify-start text-right font-normal text-sm", !rangeTo && "text-muted-foreground")}
                          onClick={() => { setShowRangeToCal((v) => !v); setShowRangeFromCal(false); }}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {rangeTo ? format(rangeTo, "dd/MM/yyyy", { locale: he }) : "סיום"}
                        </Button>
                      </div>
                    </div>
                    {showRangeFromCal && (
                      <Calendar mode="single" selected={rangeFrom} onSelect={(date) => { setRangeFrom(date); setShowRangeFromCal(false); }} locale={he} className={cn("p-3 pointer-events-auto rounded-lg border")} />
                    )}
                    {showRangeToCal && (
                      <Calendar mode="single" selected={rangeTo} onSelect={(date) => { setRangeTo(date); setShowRangeToCal(false); }} disabled={(date) => rangeFrom ? date < rangeFrom : false} locale={he} className={cn("p-3 pointer-events-auto rounded-lg border")} />
                    )}
                  </div>
                )}

                {dateMode === "specific" && (
                  <div className="space-y-2">
                    <Calendar
                      mode="multiple"
                      selected={specificDates}
                      onSelect={(dates) => setSpecificDates(dates || [])}
                      locale={he}
                      className={cn("p-3 pointer-events-auto rounded-lg border")}
                    />
                    {specificDates.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {[...specificDates]
                          .sort((a, b) => a.getTime() - b.getTime())
                          .map((d, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                              {format(d, "dd/MM")}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="in_progress">בביצוע</SelectItem>
                    <SelectItem value="completed">הושלם</SelectItem>
                    <SelectItem value="cancelled">בוטל</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>דגשים והערות לביצוע</Label>
                <Textarea value={form.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} placeholder="הוראות מיוחדות למבצע..." rows={3} />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.requires_photo} onCheckedChange={(v) => set("requires_photo", v)} />
                  <Label>נדרשת תמונה</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.requires_video} onCheckedChange={(v) => set("requires_video", v)} />
                  <Label>נדרש וידאו</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground" disabled={updateTask.isPending}>
                  {updateTask.isPending ? "מעדכן..." : "עדכן משימה"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>מחיקת משימה</AlertDialogTitle>
                      <AlertDialogDescription>האם אתה בטוח שברצונך למחוק משימה זו? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTask.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleteTask.isPending ? "מוחק..." : "מחק"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="report" className="mt-4">
            <FieldReportViewer taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
