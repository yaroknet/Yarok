import { useState } from "react";
import { useIsMobile } from "@/employees/hooks/use-mobile";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Switch } from "@/employees/components/ui/switch";
import { Textarea } from "@/employees/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/employees/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/employees/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import { Calendar } from "@/employees/components/ui/calendar";
import { ChevronsUpDown, Check, CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/employees/lib/utils";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const WORK_TYPES = [
  "ויטרינות",
  "גובה",
  "רבעוני",
  "רבעוני סופר פארם",
  "ניקיון יסודי אחרי שיפוץ",
  "גובה חודשי קסטרו",
  "שילוט",
  "הסרת מדבקה מויטרינה + ניקיון ויטרינה",
  "תגבור",
  "אספקת כח אדם",
  "אחר",
];

const SIDES_WORK_TYPES = ["ויטרינות", "הסרת מדבקה מויטרינה + ניקיון ויטרינה"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTaskDialog({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    network_id: "",
    branch_id: "",
    work_type: "",
    custom_work_type: "",
    frequency: "one_time",
    sides_required: 1,
    total_client_price: "",
    total_contractor_price: "",
    assigned_to: "",
    due_date: "",
    start_date: "",
    end_date: "",
    requires_photo: true,
    requires_video: false,
    admin_notes: "",
  });

  const [dateMode, setDateMode] = useState<"single" | "range" | "specific">("single");
  const [specificDates, setSpecificDates] = useState<Date[]>([]);
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>();
  const [rangeTo, setRangeTo] = useState<Date | undefined>();

  const [showDueDateCal, setShowDueDateCal] = useState(false);
  const [showRangeFromCal, setShowRangeFromCal] = useState(false);
  const [showRangeToCal, setShowRangeToCal] = useState(false);

  const [networkOpen, setNetworkOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [networkSearch, setNetworkSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; existing: any[] }>({ show: false, existing: [] });

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

  const createNetwork = async (name: string) => {
    const { data, error } = await supabase.from("networks").insert({ name }).select("id").single();
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["networks"] });
    return data.id;
  };

  const createBranch = async (name: string) => {
    const { data, error } = await supabase.from("branches").insert({ name, network_id: form.network_id, city: selectedCity || null }).select("id").single();
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["branches", form.network_id] });
    return data.id;
  };

  const doInsertTask = async () => {
    const workType = form.work_type === "אחר" ? form.custom_work_type : form.work_type;
    if (!workType) throw new Error("סוג עבודה הוא שדה חובה");
    const selectedLeader = teamLeaders.find((tl: any) => tl.user_id === form.assigned_to);

    let dueDate: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (dateMode === "single") {
      dueDate = form.due_date || null;
    } else if (dateMode === "range") {
      startDate = rangeFrom ? format(rangeFrom, "yyyy-MM-dd") : null;
      endDate = rangeTo ? format(rangeTo, "yyyy-MM-dd") : null;
      dueDate = endDate;
    } else if (dateMode === "specific" && specificDates.length > 0) {
      const sorted = [...specificDates].sort((a, b) => a.getTime() - b.getTime());
      const formattedDates = sorted.map((date) => format(date, "yyyy-MM-dd"));
      startDate = formattedDates[0];
      endDate = formattedDates[formattedDates.length - 1];
      dueDate = endDate;

      const { error } = await supabase.from("tasks").insert({
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
        specific_dates: formattedDates,
        requires_photo: form.requires_photo,
        requires_video: form.requires_video,
        is_recurring: form.frequency !== "one_time",
        admin_notes: form.admin_notes || null,
      } as any);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("tasks").insert({
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
      specific_dates: null,
      requires_photo: form.requires_photo,
      requires_video: form.requires_video,
      is_recurring: form.frequency !== "one_time",
      admin_notes: form.admin_notes || null,
    } as any);
    if (error) throw error;
  };

  const checkDuplicateAndSubmit = async () => {
    const workType = form.work_type === "אחר" ? form.custom_work_type : form.work_type;
    if (!form.branch_id || !workType) {
      createTask.mutate();
      return;
    }
    const { data: existing } = await supabase
      .from("tasks")
      .select("id, work_type, frequency, branches(name, networks(name))")
      .eq("branch_id", form.branch_id)
      .eq("work_type", workType);

    if (existing && existing.length > 0) {
      setDuplicateWarning({ show: true, existing });
    } else {
      createTask.mutate();
    }
  };

  const createTask = useMutation({
    mutationFn: doInsertTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks-export"] });
      onOpenChange(false);
      toast({ title: "משימה נוצרה בהצלחה" });
      setForm({
        network_id: "", branch_id: "", work_type: "", custom_work_type: "", frequency: "one_time",
        sides_required: 1, total_client_price: "", total_contractor_price: "",
        assigned_to: "", due_date: "", start_date: "", end_date: "", requires_photo: true, requires_video: false, admin_notes: "",
      });
      setDateMode("single");
      setSpecificDates([]);
      setRangeFrom(undefined);
      setRangeTo(undefined);
      setSelectedCity("");
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const selectedNetwork = networks.find((n: any) => n.id === form.network_id);
  const uniqueCities = [...new Set(branches.filter((b: any) => b.city).map((b: any) => b.city as string))].sort((a, b) => a.localeCompare(b, "he"));
  const filteredBranches = selectedCity ? branches.filter((b: any) => b.city === selectedCity) : branches;
  const selectedBranch = filteredBranches.find((b: any) => b.id === form.branch_id) || branches.find((b: any) => b.id === form.branch_id);
  const showSides = SIDES_WORK_TYPES.includes(form.work_type);

  const isValid = form.branch_id && (form.work_type === "אחר" ? form.custom_work_type.trim() : form.work_type) && form.frequency && form.assigned_to;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className={isMobile ? "max-w-full h-full max-h-full rounded-none overflow-y-auto" : "max-h-[90vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); checkDuplicateAndSubmit(); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Network - creatable */}
            <div className="space-y-2">
              <Label>רשת *</Label>
              <Popover open={networkOpen} onOpenChange={setNetworkOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedNetwork ? selectedNetwork.name : "בחר רשת"}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
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
                              const id = await createNetwork(networkSearch.trim());
                              set("network_id", id); set("branch_id", ""); setSelectedCity(""); setNetworkOpen(false); setNetworkSearch("");
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
              <Label>עיר</Label>
              <Popover open={cityOpen} onOpenChange={setCityOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!form.network_id}>
                    {selectedCity || "בחר עיר"}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
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
                        <CommandItem value="__all__" onSelect={() => { setSelectedCity(""); set("branch_id", ""); setCityOpen(false); setCitySearch(""); }}>
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

            {/* Branch - creatable */}
            <div className="space-y-2">
              <Label>סניף *</Label>
              <Popover open={branchOpen} onOpenChange={setBranchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!form.network_id}>
                    {selectedBranch ? selectedBranch.name : "בחר סניף"}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
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
                              const id = await createBranch(branchSearch.trim());
                              set("branch_id", id); setBranchOpen(false); setBranchSearch("");
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


          <div className="space-y-2">
            <Label>סוג עבודה *</Label>
            <Select value={form.work_type} onValueChange={(v) => set("work_type", v)}>
              <SelectTrigger><SelectValue placeholder="בחר סוג עבודה" /></SelectTrigger>
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
              <Button
                type="button"
                variant={dateMode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateMode("single")}
              >
                יום ספציפי
              </Button>
              <Button
                type="button"
                variant={dateMode === "range" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateMode("range")}
              >
                טווח תאריכים
              </Button>
              <Button
                type="button"
                variant={dateMode === "specific" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateMode("specific")}
              >
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
                    selected={form.due_date ? new Date(form.due_date) : undefined}
                    onSelect={(date) => {
                      set("due_date", date ? format(date, "yyyy-MM-dd") : "");
                      setShowDueDateCal(false);
                    }}
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
                  <Calendar
                    mode="single"
                    selected={rangeFrom}
                    onSelect={(date) => { setRangeFrom(date); setShowRangeFromCal(false); }}
                    locale={he}
                    className={cn("p-3 pointer-events-auto rounded-lg border")}
                  />
                )}
                {showRangeToCal && (
                  <Calendar
                    mode="single"
                    selected={rangeTo}
                    onSelect={(date) => { setRangeTo(date); setShowRangeToCal(false); }}
                    disabled={(date) => rangeFrom ? date < rangeFrom : false}
                    locale={he}
                    className={cn("p-3 pointer-events-auto rounded-lg border")}
                  />
                )}
                {rangeFrom && rangeTo && (
                  <p className="text-xs text-muted-foreground">
                    {format(rangeFrom, "dd/MM/yyyy")} — {format(rangeTo, "dd/MM/yyyy")}
                  </p>
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
                    {specificDates
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

          {/* Admin notes / instructions */}
          <div className="space-y-2">
            <Label>דגשים והערות לביצוע</Label>
            <Textarea
              value={form.admin_notes}
              onChange={(e) => set("admin_notes", e.target.value)}
              placeholder="הוראות מיוחדות למבצע..."
              rows={3}
            />
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

          <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={createTask.isPending || !isValid}>
            {createTask.isPending ? "יוצר..." : "צור משימה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={duplicateWarning.show} onOpenChange={(open) => setDuplicateWarning(prev => ({ ...prev, show: open }))}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            אזהרת כפילות
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-2">
            <p>כבר קיימות משימות עם אותו סניף וסוג עבודה:</p>
            <div className="bg-destructive/10 rounded-md p-3 space-y-1 text-sm">
              {duplicateWarning.existing.map((t: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="font-medium">{(t.branches as any)?.networks?.name}</span>
                  <span>→</span>
                  <span>{(t.branches as any)?.name}</span>
                  <span>({t.work_type})</span>
                </div>
              ))}
            </div>
            <p className="font-semibold">האם אתה בטוח שברצונך ליצור משימה נוספת?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setDuplicateWarning({ show: false, existing: [] });
              createTask.mutate();
            }}
          >
            צור בכל זאת
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
