import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle2, AlertTriangle, Eye, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ImportSummary = {
  vehicles: { created: number; updated: number };
  drivers: { created: number; reused: number };
  assignments: { created: number; unchanged: number };
  monthly_km: { inserted: number; updated: number };
  fines: { inserted: number; skipped: number };
  warnings: string[];
  preview?: Array<{ plate: string; action: "create" | "update"; driver?: string; fields: string[] }>;
  detected_fields?: string[];
  missing_fields?: string[];
};

export function FleetImportPanel() {
  const [loading, setLoading] = useState(false);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError(null); setPreview(null); setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = ""; const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      const b64 = btoa(binary);
      setFileB64(b64); setFileName(file.name);
      const { data, error: fnErr } = await supabase.functions.invoke("fleet-import", { body: { file_base64: b64, dry_run: true } });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setPreview(data.summary);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      toast.error("שגיאה: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false); e.target.value = "";
    }
  };

  const executeImport = async () => {
    if (!fileB64) return;
    setLoading(true); setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("fleet-import", { body: { file_base64: fileB64, dry_run: false } });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setResult(data.summary); setPreview(null); setFileB64(null);
      toast.success("הייבוא בוצע בהצלחה");
    } catch (err: any) {
      setError(err?.message ?? String(err));
      toast.error("שגיאה: " + (err?.message ?? String(err)));
    } finally { setLoading(false); }
  };

  const reset = () => { setPreview(null); setResult(null); setFileB64(null); setError(null); };

  return (
    <div dir="rtl" className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Upload className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">ייבוא נתונים מקובץ Excel</h3>
            <p className="text-sm text-muted-foreground mb-4">
              יוצג Preview עם כמה רכבים/נהגים ייווצרו או יעודכנו. הייבוא בפועל רק אחרי אישור.
            </p>
            <label className="inline-flex items-center gap-2">
              <input type="file" accept=".xlsx,.xls" onChange={onFile} disabled={loading}
                className="block text-sm file:mr-2 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent" />
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </label>
          </div>
        </div>
      </Card>

      {error && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}

      {preview && (
        <Card className="p-6 border-primary/50">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Preview — {fileName}</h3>
            <div className="mr-auto flex gap-2">
              <Button variant="ghost" onClick={reset}>ביטול</Button>
              <Button onClick={executeImport} disabled={loading}><PlayCircle className="h-4 w-4 ml-1" />בצע ייבוא בפועל</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <Stat label="רכבים חדשים" value={preview.vehicles.created} tone="ok" />
            <Stat label="רכבים לעדכון" value={preview.vehicles.updated} tone="warn" />
            <Stat label="נהגים חדשים" value={preview.drivers.created} tone="ok" />
            <Stat label="נהגים קיימים" value={preview.drivers.reused} />
          </div>

          {(preview.detected_fields?.length || preview.missing_fields?.length) && (
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-xs font-semibold mb-1 text-emerald-600">שדות שזוהו ({preview.detected_fields?.length})</div>
                <div className="flex flex-wrap gap-1">{preview.detected_fields?.map(f => <Badge key={f} variant="outline">{f}</Badge>)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-orange-600">שדות חסרים ({preview.missing_fields?.length})</div>
                <div className="flex flex-wrap gap-1">{preview.missing_fields?.map(f => <Badge key={f} variant="secondary">{f}</Badge>)}</div>
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto border rounded">
            <Table>
              <TableHeader><TableRow><TableHead>מס' רכב</TableHead><TableHead>פעולה</TableHead><TableHead>נהג</TableHead><TableHead>שדות שיטופלו</TableHead></TableRow></TableHeader>
              <TableBody>
                {(preview.preview ?? []).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{p.plate}</TableCell>
                    <TableCell><Badge variant={p.action === "create" ? "default" : "secondary"}>{p.action === "create" ? "צור חדש" : "עדכן"}</Badge></TableCell>
                    <TableCell>{p.driver ?? "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.fields.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {preview.warnings.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2 text-sm text-orange-600">אזהרות ({preview.warnings.length}):</div>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {preview.warnings.slice(0, 100).map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}

      {result && (
        <Card className="p-6 border-emerald-500/50">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">סיכום ייבוא</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Stat label="רכבים חדשים" value={result.vehicles.created} />
            <Stat label="רכבים עודכנו" value={result.vehicles.updated} />
            <Stat label="נהגים חדשים" value={result.drivers.created} />
            <Stat label="נהגים קיימים" value={result.drivers.reused} />
            <Stat label='שורות ק"מ' value={result.monthly_km.inserted} />
            <Stat label="קנסות נקלטו" value={result.fines.inserted} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const cls = tone === "ok" ? "border-emerald-500/40 bg-emerald-500/10" : tone === "warn" ? "border-orange-500/40 bg-orange-500/10" : "";
  return (<div className={`border rounded p-3 ${cls}`}><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>);
}
