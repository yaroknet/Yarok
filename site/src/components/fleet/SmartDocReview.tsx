import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, XCircle, Clock } from "lucide-react";

export type SmartDocRow = {
  id: string;
  doc_type: string;
  vehicle_id: string | null;
  driver_id: string | null;
  file_url: string | null;
  title: string;
  analysis_status?: string | null;
  extracted_data?: Record<string, any> | null;
  analysis_notes?: string | null;
};

export const SMART_DOC_TYPES = ["רישיון נהיגה", "רישיון רכב", "ביטוח"];

export function isSmartDocType(t?: string | null): boolean {
  if (!t) return false;
  return SMART_DOC_TYPES.some((x) => t.includes(x));
}

/* ----- extraction spec (must mirror the edge function) ----- */

type FieldSpec = { key: string; label: string; type: "text" | "date" | "number" };

export function fieldsFor(docType: string): FieldSpec[] {
  const t = docType || "";
  if (t.includes("רישיון נהיגה"))
    return [
      { key: "full_name", label: "שם מלא", type: "text" },
      { key: "id_number", label: "תעודת זהות", type: "text" },
      { key: "license_number", label: "מספר רישיון", type: "text" },
      { key: "license_expiry", label: "תוקף רישיון", type: "date" },
    ];
  if (t.includes("רישיון רכב"))
    return [
      { key: "license_plate", label: "מספר רכב", type: "text" },
      { key: "make", label: "יצרן", type: "text" },
      { key: "model", label: "דגם", type: "text" },
      { key: "year", label: "שנת ייצור", type: "number" },
      { key: "vin", label: "מספר שלדה", type: "text" },
      { key: "test_expiry_date", label: "תוקף טסט", type: "date" },
    ];
  if (t.includes("ביטוח"))
    return [
      { key: "insurance_company", label: "חברת ביטוח", type: "text" },
      { key: "policy_number", label: "מספר פוליסה", type: "text" },
      { key: "insurance_start_date", label: "תחילת ביטוח", type: "date" },
      { key: "insurance_expiry_date", label: "סיום ביטוח", type: "date" },
    ];
  return [];
}

function normalizeDateForInput(v: unknown): string {
  if (!v || typeof v !== "string") return "";
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/* ---------- edge-function helpers ---------- */

export async function analyzeDoc(document_id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("fleet-doc-ai", {
    body: { action: "analyze", document_id },
  });
  if (error) return { ok: false, error: error.message };
  if ((data as any)?.error) return { ok: false, error: (data as any).error };
  return { ok: true };
}

async function applyDoc(document_id: string, payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("fleet-doc-ai", {
    body: { action: "apply", document_id, data: payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any)?.message as string;
}

async function ignoreDoc(document_id: string) {
  const { error } = await supabase.functions.invoke("fleet-doc-ai", {
    body: { action: "ignore", document_id },
  });
  if (error) throw new Error(error.message);
}

/* ---------- Status badge ---------- */

export function SmartDocStatusBadge({ status, docType }: { status?: string | null; docType?: string }) {
  if (!isSmartDocType(docType)) return null;
  const s = status || "pending";
  const map: Record<string, { text: string; className: string; Icon: any }> = {
    pending:      { text: "ממתין לסריקה", className: "bg-muted text-muted-foreground",           Icon: Clock },
    analyzing:    { text: "סורק...",       className: "bg-blue-100 text-blue-700 border-blue-200", Icon: Loader2 },
    detected:     { text: "נתונים זוהו",   className: "bg-amber-100 text-amber-800 border-amber-200", Icon: Sparkles },
    needs_review: { text: "דורש בדיקה",    className: "bg-orange-100 text-orange-800 border-orange-200", Icon: AlertTriangle },
    applied:      { text: "עודכן במערכת",  className: "bg-green-100 text-green-700 border-green-200",   Icon: CheckCircle2 },
    failed:       { text: "סריקה נכשלה",   className: "bg-red-100 text-red-700 border-red-200",         Icon: XCircle },
    ignored:      { text: "בוטל",          className: "bg-muted text-muted-foreground",                  Icon: XCircle },
  };
  const cfg = map[s] ?? map.pending;
  const spin = s === "analyzing" ? "animate-spin" : "";
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${cfg.className}`}>
      <cfg.Icon className={`h-3 w-3 ${spin}`} />
      {cfg.text}
    </Badge>
  );
}

/* ---------- Review dialog ---------- */

export function SmartDocReviewDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: SmartDocRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<"analyzing" | "applying" | null>(null);
  const fields = useMemo(() => (doc ? fieldsFor(doc.doc_type) : []), [doc]);

  useEffect(() => {
    if (!doc) return;
    const base: Record<string, any> = {};
    for (const f of fieldsFor(doc.doc_type)) {
      const raw = doc.extracted_data?.[f.key];
      base[f.key] = f.type === "date" ? normalizeDateForInput(raw) : (raw ?? "");
    }
    setValues(base);
  }, [doc?.id, doc?.extracted_data]);

  if (!doc) return null;

  const runAnalyze = async () => {
    setBusy("analyzing");
    const r = await analyzeDoc(doc.id);
    setBusy(null);
    if (!r.ok) return toast.error(r.error || "סריקה נכשלה");
    toast.success("סריקה הושלמה");
    onDone();
  };

  const runApply = async () => {
    setBusy("applying");
    try {
      const msg = await applyDoc(doc.id, values);
      toast.success(msg || "עודכן במערכת");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "עדכון נכשל");
    } finally {
      setBusy(null);
    }
  };

  const runIgnore = async () => {
    try {
      await ignoreDoc(doc.id);
      toast.info("בוטל");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const status = doc.analysis_status || "pending";
  const showEmpty = !doc.extracted_data;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            נתונים שזוהו במסמך
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            {doc.title} · {doc.doc_type}
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <SmartDocStatusBadge status={status} docType={doc.doc_type} />
          {doc.analysis_notes && status === "failed" && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{doc.analysis_notes}</div>
          )}

          {showEmpty ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              המסמך עדיין לא נסרק. לחץ/י "סרוק וזהה" כדי לחלץ נתונים אוטומטית.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "text" && f.key === "full_name" ? "col-span-2 space-y-1" : "space-y-1"}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
            עדכון יבוצע לפי הרכב של תיקיית המסמך. אפשר לערוך שדות לפני האישור.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={runIgnore} disabled={!!busy}>
            <XCircle className="h-4 w-4 ml-1" /> התעלם
          </Button>
          <Button variant="outline" onClick={runAnalyze} disabled={!!busy}>
            {busy === "analyzing" ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Sparkles className="h-4 w-4 ml-1" />}
            {doc.extracted_data ? "סרוק שוב" : "סרוק וזהה"}
          </Button>
          <Button onClick={runApply} disabled={!!busy || !doc.extracted_data}>
            {busy === "applying" ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
            אשר ועדכן מערכת
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
