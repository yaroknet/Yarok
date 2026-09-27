import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Label } from "@/employees/components/ui/label";
import { Input } from "@/employees/components/ui/input";
import { Textarea } from "@/employees/components/ui/textarea";
import { Button } from "@/employees/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Calendar } from "@/employees/components/ui/calendar";
import { CalendarIcon, User, Phone, Building2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/employees/lib/utils";
import { supabase } from "@/employees/integrations/supabase/client";
import { createWashingMachineTask } from "@/employees/lib/washingMachineTask";
import { createTimeWatchTask } from "@/employees/lib/timeWatchTask";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import { useIsMobile } from "@/employees/hooks/use-mobile";

/* ---- Autocomplete Input ---- */
function AutocompleteInput({
  value, onChange, suggestions, placeholder, icon, label,
}: {
  value: string; onChange: (v: string) => void;
  suggestions: { id: string; name: string }[];
  placeholder: string; icon?: React.ReactNode; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = suggestions.filter((s) => s.name.toLowerCase().includes(inputValue.toLowerCase()));
  const trimmed = inputValue.trim();
  const exactMatch = suggestions.some((s) => s.name === trimmed);
  const showCreate = trimmed.length > 0 && !exactMatch;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">{icon}{label}</Label>
      <div ref={wrapperRef} className="relative">
        <Input
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); onChange(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onChange(trimmed); setOpen(false); } }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        {open && (filtered.length > 0 || showCreate) && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {showCreate && (
              <button type="button" className="w-full text-right px-3 py-2 text-sm hover:bg-accent cursor-pointer font-medium text-primary"
                onMouseDown={(e) => { e.preventDefault(); setInputValue(trimmed); onChange(trimmed); setOpen(false); }}>
                + צור &quot;{trimmed}&quot;
              </button>
            )}
            {filtered.map((s) => (
              <button key={s.id} type="button" className="w-full text-right px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                onMouseDown={(e) => { e.preventDefault(); setInputValue(s.name); onChange(s.name); setOpen(false); }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LOGISTICS_OPTIONS = ["חומרים בסיסיים", "טואלטיקה", "מכונת שטיפה", "שואב אבק", "שקיות", "ללא חומרים כלל", "אחר"];
const ACTION_LABELS: Record<string, string> = { start: "התחלת שירות", update: "עדכון שירות", stop: "הפסקת שירות" };

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: any;
}

export function EditServiceModal({ open, onOpenChange, service }: EditServiceModalProps) {
  const [networkName, setNetworkName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [managerId, setManagerId] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(1);
  const [hoursPerVisit, setHoursPerVisit] = useState(1);
  const [logistics, setLogistics] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [dateOption, setDateOption] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [hasSignedAgreement, setHasSignedAgreement] = useState(false);
  const [hasClientDetails, setHasClientDetails] = useState(false);
  const [hasBillingNotification, setHasBillingNotification] = useState(false);
  const [stopHilaNotified, setStopHilaNotified] = useState(false);
  const [stopRotemNotified, setStopRotemNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [otherLogistic, setOtherLogistic] = useState("");

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const weeklyTotal = useMemo(() => daysPerWeek * hoursPerVisit, [daysPerWeek, hoursPerVisit]);

  // Load service data
  useEffect(() => {
    if (service && open) {
      setNetworkName(service.network_name || "");
      setBranchName(service.branch_name || "");
      setSelectedCity("");
      setContactPerson(service.contact_person || "");
      setContactPhone(service.contact_phone || "");
      setManagerId(service.manager_id || "");
      setDaysPerWeek(service.days_per_week || 1);
      setHoursPerVisit(service.hours_per_visit || 1);
      const svcLogistics = service.logistics || [];
      setLogistics(svcLogistics);
      // Extract "אחר: ..." from saved logistics
      const otherItem = svcLogistics.find((l: string) => l.startsWith("אחר:"));
      if (otherItem) {
        setOtherLogistic(otherItem.replace("אחר: ", ""));
        setLogistics(svcLogistics.map((l: string) => l.startsWith("אחר:") ? "אחר" : l));
      } else {
        setOtherLogistic("");
      }
      setNotes(service.notes || "");
      setDateOption(service.date_option || "");
      setSelectedDate(service.specific_date ? new Date(service.specific_date) : undefined);
      setHasSignedAgreement(service.has_signed_agreement || false);
      setHasClientDetails(service.has_client_details || false);
      setHasBillingNotification(service.has_billing_notification || false);
      setStopHilaNotified(service.stop_hila_notified || false);
      setStopRotemNotified(service.stop_rotem_notified || false);
    }
  }, [service, open]);

  const { data: networks = [] } = useQuery({
    queryKey: ["networks-select"], queryFn: async () => {
      const { data } = await supabase.from("networks").select("id, name").order("name");
      return data || [];
    }, enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-all-select"], queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, name, city, network_id").order("name");
      return data || [];
    }, enabled: open,
  });

  const branchesForNetwork = useMemo(() => {
    const net = networks.find((n: any) => n.name === networkName);
    return net ? branches.filter((b: any) => b.network_id === net.id) : branches;
  }, [networkName, networks, branches]);

  const uniqueCities = useMemo(() =>
    [...new Set(branchesForNetwork.filter((b: any) => b.city).map((b: any) => b.city as string))].sort((a, b) => a.localeCompare(b, "he")),
    [branchesForNetwork]);

  const filteredBranches = useMemo(() =>
    selectedCity ? branchesForNetwork.filter((b: any) => b.city === selectedCity) : branchesForNetwork,
    [branchesForNetwork, selectedCity]);

  const { data: managers = [] } = useQuery({
    queryKey: ["managers-select"], queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").neq("role", "contractor");
      if (!roles?.length) return [];
      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return profiles || [];
    }, enabled: open,
  });

  const handleSave = async () => {
    if (!networkName.trim() || !branchName.trim()) {
      toast({ title: "שגיאה", description: "יש למלא רשת וסניף", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalLogistics = logistics.map((l) =>
        l === "אחר" && otherLogistic.trim() ? `אחר: ${otherLogistic.trim()}` : l
      );
      const specificDateStr = dateOption === "specific" && selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

      const updateData = {
        network_name: networkName.trim(),
        branch_name: branchName.trim(),
        contact_person: contactPerson || null,
        contact_phone: contactPhone || null,
        manager_id: managerId || null,
        days_per_week: daysPerWeek,
        hours_per_visit: hoursPerVisit,
        logistics: finalLogistics,
        notes: notes || null,
        date_option: dateOption || null,
        specific_date: specificDateStr,
        assigned_to: managerId || null,
        has_signed_agreement: service.action_type === "start" ? hasSignedAgreement : false,
        has_client_details: service.action_type === "start" ? hasClientDetails : false,
        has_billing_notification: service.action_type === "start" ? hasBillingNotification : false,
        stop_hila_notified: service.action_type === "stop" ? stopHilaNotified : false,
        stop_rotem_notified: service.action_type === "stop" ? stopRotemNotified : false,
      };

      const { data, error } = await supabase.from("services").update(updateData as any).eq("id", service.id).select().single();
      if (error) throw error;

      // WhatsApp notification is sent automatically via DB trigger (notify_service_changed)
      // Do NOT send manually here to avoid duplicate messages

      // Auto-create Time Watch task for Orit
      const managerProfile = managers?.find((m: any) => m.user_id === managerId);
      await createTimeWatchTask({
        actionType: service.action_type as "start" | "update" | "stop",
        networkName: networkName.trim(),
        branchName: branchName.trim(),
        assignedToName: managerProfile?.full_name || "",
        daysPerWeek,
        hoursPerVisit,
        dateOption,
        specificDate: specificDateStr,
        notes,
      });

      qc.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "עודכן בהצלחה", description: "פרטי השירות עודכנו והודעת תיקון נשלחה למבצע" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message || "שגיאה בעדכון", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!service) return null;
  const actionType = service.action_type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className={cn("max-w-2xl overflow-y-auto", isMobile ? "max-w-full h-full max-h-full rounded-none" : "max-h-[90vh]")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-primary" />
            עריכת שירות — {ACTION_LABELS[actionType] || actionType}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Entity */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">זיהוי ישות</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AutocompleteInput value={networkName} onChange={(v) => { setNetworkName(v); setBranchName(""); setSelectedCity(""); }}
                suggestions={networks.map((n: any) => ({ id: n.id, name: n.name }))} placeholder="הקלד שם רשת"
                icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />} label="רשת" />
              <AutocompleteInput value={selectedCity} onChange={(v) => { setSelectedCity(v); setBranchName(""); }}
                suggestions={uniqueCities.map((c) => ({ id: c, name: c }))} placeholder="הקלד או בחר עיר"
                icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />} label="עיר" />
              <AutocompleteInput value={branchName} onChange={setBranchName}
                suggestions={filteredBranches.map((b: any) => ({ id: b.id, name: b.name }))} placeholder="הקלד שם סניף"
                icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />} label="סניף" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />איש קשר</Label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="שם איש הקשר" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />טלפון</Label>
                <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="מספר טלפון" />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">שיוך</h3>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />מנהל אחראי</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger><SelectValue placeholder="בחר מנהל אחראי" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "ללא שם"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">היקף שירות</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>ימי שירות בשבוע</Label>
                <Input type="number" min={1} max={7} value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Math.max(1, Math.min(7, Number(e.target.value))))} />
              </div>
              <div className="space-y-1.5">
                <Label>שעות בכל ביקור</Label>
                <Input type="number" min={0.5} step={0.5} value={hoursPerVisit}
                  onChange={(e) => setHoursPerVisit(Math.max(0.5, Number(e.target.value)))} />
              </div>
              <div className="space-y-1.5">
                <Label>סה"כ שעות שבועיות</Label>
                <Input value={weeklyTotal} readOnly className="bg-muted font-semibold" />
              </div>
            </div>
          </div>

          {/* Logistics - not for stop */}
          {actionType !== "stop" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">לוגיסטיקה</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOGISTICS_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={logistics.includes(option)}
                      onCheckedChange={() => setLogistics((prev) => prev.includes(option) ? prev.filter((l) => l !== option) : [...prev, option])} />
                    {option}
                  </label>
                ))}
              </div>
              {logistics.includes("אחר") && (
                <Input
                  value={otherLogistic}
                  onChange={(e) => setOtherLogistic(e.target.value)}
                  placeholder="פרט כאן..."
                  className="mt-2"
                />
              )}
            </div>
          )}

          {/* Checklist - start */}
          {actionType === "start" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">רשימת תיוג פנימית</h3>
              <div className="space-y-2.5 bg-muted/30 rounded-xl p-3 border border-border">
                <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                  <Checkbox checked={hasSignedAgreement} onCheckedChange={(v) => setHasSignedAgreement(!!v)} className="mt-0.5" />
                  <span>האם יש הסכם חתום ע״י לקוח שהועבר לידי הילה?</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                  <Checkbox checked={hasClientDetails} onCheckedChange={(v) => setHasClientDetails(!!v)} className="mt-0.5" />
                  <span>האם יש טופס פרטי לקוח מלא שהועבר לידי הילה?</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                  <Checkbox checked={hasBillingNotification} onCheckedChange={(v) => setHasBillingNotification(!!v)} className="mt-0.5" />
                  <span>האם הועבר לידיעת רותם לרישום בטבלת חיוב?</span>
                </label>
              </div>
            </div>
          )}

          {/* Checklist - stop */}
          {actionType === "stop" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">רשימת תיוג פנימית — הפסקת שירות</h3>
              <div className="space-y-2.5 bg-muted/30 rounded-xl p-3 border border-border">
                <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                  <Checkbox checked={stopHilaNotified} onCheckedChange={(v) => setStopHilaNotified(!!v)} className="mt-0.5" />
                  <span>האם הילה מעודכנת בהפסקת השירות?</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                  <Checkbox checked={stopRotemNotified} onCheckedChange={(v) => setStopRotemNotified(!!v)} className="mt-0.5" />
                  <span>האם רותם מעודכנת בהפסקת השירות לטובת טבלת חיוב?</span>
                </label>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>דגשים לבקשת הלקוח</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות ודגשים מיוחדים..." rows={3} />
          </div>

          {/* Date */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">מועד ביצוע</h3>
            <Select value={dateOption} onValueChange={setDateOption}>
              <SelectTrigger>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="בחר מועד" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">תאריך נקוב</SelectItem>
                <SelectItem value="immediate">מיידי</SelectItem>
                <SelectItem value="asap">בהקדם</SelectItem>
                <SelectItem value="coordinate">בתיאום מול איש קשר</SelectItem>
              </SelectContent>
            </Select>
            {dateOption === "specific" && (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDatePicker((prev) => !prev)}
                  className={cn("w-full justify-start", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="h-4 w-4 ml-2" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: he }) : "בחר תאריך"}
                </Button>
                {showDatePicker && (
                  <div className="rounded-lg border bg-card p-2 shadow-sm">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) setShowDatePicker(false);
                      }}
                      locale={he}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
