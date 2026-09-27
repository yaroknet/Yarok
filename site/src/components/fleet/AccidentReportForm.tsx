import { useEffect, useMemo, useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VehicleDamageMarker, DamageMarker } from "./VehicleDamageMarker";
import { ChevronLeft, ChevronRight, Check, Upload, Loader2, X, FileText, Video, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = [{ v: "reported", l: "דווח" }, { v: "in_progress", l: "בטיפול" }, { v: "closed", l: "נסגר" }];

const STEPS = [
  { id: "vehicle", label: "נהג ורכב" },
  { id: "incident", label: "פרטי תאונה" },
  { id: "third", label: "צד ג׳ ועדים" },
  { id: "media", label: "קבצים" },
  { id: "damage", label: "סימון נזק" },
  { id: "summary", label: "סיכום" },
];

export type Attachment = { url: string; name: string; type: string };
export type Witness = { name: string; phone: string };

export type AccidentPayload = {
  incident_date: string;
  location: string | null;
  description: string | null;
  damage_markers: DamageMarker[];
  attachments: Attachment[];
  third_party: {
    has_third_party: boolean;
    has_injuries: boolean;
    police_opened: boolean;
    name: string | null;
    phone: string | null;
    plate: string | null;
    witnesses: Witness[];
  };
  police_report_number: string | null;
  status: string;
  submitted_by_name?: string | null;
};

export function AccidentReportForm({
  driverSlot,
  driverId,
  vehicleId,
  driverLabel,
  vehicleLabel,
  initialItem,
  uploadFile,
  onSubmit,
  onCancel,
  showReporterName = false,
  showStatus = true,
  saving,
  submitLabel = "שליחת דיווח",
}: {
  driverSlot: ReactNode;
  driverId?: string | null;
  vehicleId?: string | null;
  driverLabel?: string;
  vehicleLabel?: string;
  initialItem?: any;
  uploadFile: (f: File) => Promise<Attachment | null>;
  onSubmit: (payload: AccidentPayload) => Promise<boolean> | boolean;
  onCancel?: () => void;
  showReporterName?: boolean;
  showStatus?: boolean;
  saving?: boolean;
  submitLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>({});
  const [markers, setMarkers] = useState<DamageMarker[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [reporterName, setReporterName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const init = initialItem ?? {
      incident_date: now.toISOString(),
      status: "reported",
      has_injuries: false,
      has_third_party: false,
      police_opened: false,
    };
    const tp = initialItem?.third_party ?? {};
    setF({
      ...init,
      has_injuries: tp.has_injuries ?? init.has_injuries ?? false,
      has_third_party: tp.has_third_party ?? Boolean(tp.name || tp.plate) ?? false,
      tp_name: tp.name ?? "",
      tp_phone: tp.phone ?? "",
      tp_plate: tp.plate ?? "",
      police_opened: tp.police_opened ?? Boolean(initialItem?.police_report_number),
    });
    setMarkers(Array.isArray(initialItem?.damage_markers) ? initialItem.damage_markers : []);
    const legacy: string[] = [...(initialItem?.photos ?? []), ...(initialItem?.license_photos ?? [])];
    const legacyAtt: Attachment[] = legacy.map((u: any, i: number) => typeof u === "string"
      ? { url: u, name: `קובץ ${i + 1}`, type: "image/*" }
      : u);
    setAttachments(Array.isArray(initialItem?.attachments) ? initialItem.attachments : legacyAtt);
    setWitnesses(Array.isArray(tp.witnesses) ? tp.witnesses : []);
    setStep(0);
  }, [initialItem]);

  const s = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const canNext = useMemo(() => {
    if (step === 0) return !!driverId && !!vehicleId && !!f.incident_date;
    return true;
  }, [step, driverId, vehicleId, f.incident_date]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const a = await uploadFile(file);
      if (a) setAttachments(prev => [...prev, a]);
    }
    setUploading(false);
  };

  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));
  const addWitness = () => setWitnesses(w => [...w, { name: "", phone: "" }]);
  const updateWitness = (i: number, k: keyof Witness, v: string) => setWitnesses(w => w.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const removeWitness = (i: number) => setWitnesses(w => w.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!driverId || !vehicleId || !f.incident_date) { toast.error("חובה: נהג, רכב ותאריך"); setStep(0); return; }
    const payload: AccidentPayload = {
      incident_date: f.incident_date,
      location: f.location || null,
      description: f.description || null,
      damage_markers: markers,
      attachments,
      third_party: {
        has_third_party: !!f.has_third_party,
        has_injuries: !!f.has_injuries,
        police_opened: !!f.police_opened,
        name: f.tp_name || null,
        phone: f.tp_phone || null,
        plate: f.tp_plate || null,
        witnesses: witnesses.filter(w => w.name || w.phone),
      },
      police_report_number: f.police_opened ? (f.police_report_number || null) : null,
      status: f.status || "reported",
      submitted_by_name: showReporterName ? (reporterName || null) : undefined,
    };
    await onSubmit(payload);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-1 pb-3 shrink-0">
        <StepBar step={step} onGo={setStep} />
      </div>

      <div className="overflow-y-auto flex-1 px-1 py-2 space-y-3">
        {step === 0 && (
          <div className="space-y-3">
            {driverSlot}
            <div className="grid grid-cols-2 gap-3">
              <Field label="תאריך *"><Input className="h-11" type="date" value={(f.incident_date ?? "").slice(0, 10)} onChange={e => s("incident_date")(e.target.value + "T" + ((f.incident_date ?? "").slice(11, 16) || "12:00"))} /></Field>
              <Field label="שעה"><Input className="h-11" type="time" value={(f.incident_date ?? "").slice(11, 16)} onChange={e => s("incident_date")((f.incident_date ?? "").slice(0, 10) + "T" + e.target.value)} /></Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Field label="מיקום"><Input className="h-11" placeholder="כתובת / צומת" value={f.location ?? ""} onChange={e => s("location")(e.target.value)} /></Field>
            <Field label="תיאור האירוע"><Textarea rows={5} placeholder="כיצד התרחשה התאונה..." value={f.description ?? ""} onChange={e => s("description")(e.target.value)} /></Field>
            <ToggleRow label="יש נפגעים" checked={!!f.has_injuries} onChange={s("has_injuries")} />
            {showStatus && (
              <Field label="סטטוס טיפול">
                <Select value={f.status ?? "reported"} onValueChange={s("status")}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <ToggleRow label="מעורב צד ג׳" checked={!!f.has_third_party} onChange={s("has_third_party")} />
            {f.has_third_party && (
              <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-muted/40">
                <Field label="שם"><Input className="h-11" value={f.tp_name ?? ""} onChange={e => s("tp_name")(e.target.value)} /></Field>
                <Field label="טלפון"><Input className="h-11" type="tel" inputMode="tel" value={f.tp_phone ?? ""} onChange={e => s("tp_phone")(e.target.value)} /></Field>
                <Field label="מספר רכב"><Input className="h-11" value={f.tp_plate ?? ""} onChange={e => s("tp_plate")(e.target.value)} /></Field>
              </div>
            )}
            <ToggleRow label="נפתחה קריאה למשטרה" checked={!!f.police_opened} onChange={s("police_opened")} />
            {f.police_opened && (
              <Field label="מספר דוח משטרה"><Input className="h-11" value={f.police_report_number ?? ""} onChange={e => s("police_report_number")(e.target.value)} /></Field>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">עדי ראייה</Label>
                <Button type="button" size="sm" variant="outline" onClick={addWitness}><Plus className="h-4 w-4 ml-1" />הוספת עד</Button>
              </div>
              {witnesses.length === 0 && <p className="text-xs text-muted-foreground">לא הוזנו עדים</p>}
              <div className="space-y-2">
                {witnesses.map((w, i) => (
                  <div key={i} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center p-2 rounded-lg bg-muted/40">
                    <Input className="h-11" placeholder="שם עד/ה" value={w.name} onChange={e => updateWitness(i, "name", e.target.value)} />
                    <Input className="h-11" placeholder="טלפון" type="tel" inputMode="tel" value={w.phone} onChange={e => updateWitness(i, "phone", e.target.value)} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeWitness(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">תמונות, מסמכים ווידאו</Label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent transition">
              <input type="file" multiple accept="image/*,application/pdf,video/*,.doc,.docx,.xls,.xlsx" className="hidden" disabled={uploading}
                onChange={e => { upload(e.target.files); e.currentTarget.value = ""; }} />
              {uploading
                ? <><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">מעלה...</span></>
                : <><Upload className="h-6 w-6" /><span className="text-sm font-medium">העלה תמונות / מסמכים / וידאו</span><span className="text-xs text-muted-foreground">ניתן לבחור כמה קבצים יחד</span></>}
            </label>
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((a, i) => (
                  <AttachmentCard key={i} att={a} onRemove={() => removeAttachment(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <VehicleDamageMarker markers={markers} onChange={setMarkers} />
        )}

        {step === 5 && (
          <div className="space-y-2 text-sm">
            <SumRow k="רכב" v={vehicleLabel || "-"} />
            <SumRow k="נהג" v={driverLabel || "-"} />
            <SumRow k="תאריך" v={(f.incident_date ?? "").replace("T", " ").slice(0, 16)} />
            <SumRow k="מיקום" v={f.location || "-"} />
            <SumRow k="נפגעים" v={f.has_injuries ? "כן" : "לא"} />
            <SumRow k="צד ג׳" v={f.has_third_party ? `${f.tp_name || ""} · ${f.tp_plate || ""}` : "לא"} />
            <SumRow k="משטרה" v={f.police_opened ? (f.police_report_number || "כן") : "לא"} />
            <SumRow k="עדי ראייה" v={witnesses.filter(w => w.name || w.phone).length} />
            <SumRow k="קבצים" v={attachments.length} />
            <SumRow k="נקודות נזק" v={markers.length} />
            {showStatus && <SumRow k="סטטוס" v={STATUSES.find(x => x.v === f.status)?.l ?? "-"} />}
            {showReporterName && (
              <div className="pt-3">
                <Field label="שם המדווח"><Input className="h-11" value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="שמך" /></Field>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 mt-3 border-t shrink-0 flex justify-between gap-2">
        <div>
          {step > 0 && <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}><ChevronRight className="h-4 w-4 ml-1" />הקודם</Button>}
        </div>
        <div className="flex gap-2">
          {onCancel && <Button variant="ghost" size="lg" onClick={onCancel}>ביטול</Button>}
          {step < STEPS.length - 1 ? (
            <Button size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>הבא<ChevronLeft className="h-4 w-4 mr-1" /></Button>
          ) : (
            <Button size="lg" disabled={saving} onClick={handleSubmit}><Check className="h-4 w-4 ml-1" />{saving ? "שומר..." : submitLabel}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBar({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((s, i) => (
        <button key={s.id} onClick={() => onGo(i)}
          className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded text-[11px] whitespace-nowrap transition ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-background/40 text-[10px] font-bold">{i + 1}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (<div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>);
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AttachmentCard({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const isImg = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
      {isImg ? (
        <a href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} className="w-full h-full object-cover" /></a>
      ) : (
        <a href={att.url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 h-full p-2 text-center">
          {isVideo ? <Video className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
          <span className="text-[10px] truncate w-full">{att.name}</span>
        </a>
      )}
      <button type="button" onClick={onRemove}
        className="absolute top-1 left-1 h-7 w-7 rounded-full bg-destructive text-destructive-foreground text-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center justify-center">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SumRow({ k, v }: { k: string; v: any }) {
  return (<div className="flex justify-between border-b py-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>);
}
