import { useState, useRef } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Upload, Download, FileSpreadsheet, FileDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  TEMPLATE_HEADERS,
  buildSheetMapping,
  extractImportTask,
  normalizeText,
  normalizeLookupKey,
  ParsedImportTask,
} from "@/employees/lib/taskImport";

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; sheet: string; reason: string }[];
  perNetwork: Record<string, { imported: number; failed: number }>;
}

export default function AdminImportExport() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, branches(name, city, address, networks(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });

      interface RowMeta { row: unknown[]; rowNum: number; sheet: string; networkHint?: string }
      const allRows: RowMeta[] = [];
      let finalMapping: Record<string, number> = {};

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (json.length < 2) continue;

        const headers = json[0].map(String);
        const sheetData = json.slice(1).filter((r) => r.some((c: any) => c != null && c !== ""));
        const mapping = buildSheetMapping(headers);

        console.log(`Sheet "${sheetName}" headers:`, headers, "mapped:", mapping, "rows:", sheetData.length);

        if (mapping["network_name"] == null || mapping["branch_name"] == null) {
          console.log(`Skipping sheet "${sheetName}" - missing רשת/סניף columns`);
          continue;
        }

        if (Object.keys(finalMapping).length === 0) {
          finalMapping = mapping;
        }

        for (let i = 0; i < sheetData.length; i++) {
          let finalRow: any[];
          if (JSON.stringify(mapping) !== JSON.stringify(finalMapping)) {
            const remapped: any[] = [];
            for (const [field, targetIdx] of Object.entries(finalMapping)) {
              const sourceIdx = mapping[field];
              if (sourceIdx != null) remapped[targetIdx] = sheetData[i][sourceIdx];
            }
            finalRow = remapped;
          } else {
            finalRow = sheetData[i];
          }
          allRows.push({ row: finalRow, rowNum: i + 2, sheet: sheetName });
        }
      }

      if (allRows.length === 0 || Object.keys(finalMapping).length === 0) {
        toast({ title: "שגיאה", description: "לא נמצאו נתונים תקינים בקובץ (חסרות עמודות 'רשת' ו'סניף')", variant: "destructive" });
        return;
      }

      await doImport(allRows, finalMapping);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = async (
    rows: { row: unknown[]; rowNum: number; sheet: string }[],
    colMap: Record<string, number>
  ) => {
    setImporting(true);
    const result: ImportResult = { total: rows.length, imported: 0, failed: 0, errors: [], perNetwork: {} };

    try {
      // Fetch profiles
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name");
      const profileMap: Record<string, string> = {};
      (allProfiles || []).forEach((p: any) => {
        const key = normalizeLookupKey(p.full_name);
        if (key) profileMap[key] = p.user_id;
      });

      // Parse all rows, track errors per row
      const parsed: { task: ParsedImportTask; meta: typeof rows[0] }[] = [];
      for (const meta of rows) {
        const task = extractImportTask(meta.row, colMap, profileMap);
        if (!task) {
          result.failed++;
          result.errors.push({ row: meta.rowNum, sheet: meta.sheet, reason: "שורה ריקה או חסרים שדות חובה (רשת/סניף)" });
          continue;
        }
        parsed.push({ task, meta });
      }

      if (parsed.length === 0) {
        setImportResult(result);
        toast({ title: "שגיאת ייבוא", description: "לא נמצאו שורות תקינות", variant: "destructive" });
        return;
      }

      // Fetch/create networks
      const { data: existingNetworks } = await supabase.from("networks").select("id, name");
      const networkMap: Record<string, string> = {};
      (existingNetworks || []).forEach((n: any) => {
        networkMap[normalizeLookupKey(n.name)] = n.id;
      });

      const uniqueNetworks = [...new Set(parsed.map((p) => normalizeLookupKey(p.task.networkName)))];
      for (const key of uniqueNetworks) {
        if (networkMap[key]) continue;
        const originalName = parsed.find((p) => normalizeLookupKey(p.task.networkName) === key)!.task.networkName;
        const { data: created, error } = await supabase.from("networks").insert({ name: originalName }).select("id, name").single();
        if (error) throw error;
        networkMap[normalizeLookupKey(created.name)] = created.id;
      }

      // Fetch/create branches
      const networkIds = [...new Set(Object.values(networkMap))];
      const { data: existingBranches } = await supabase.from("branches").select("id, name, network_id").in("network_id", networkIds);
      const branchMap: Record<string, string> = {};
      (existingBranches || []).forEach((b: any) => {
        branchMap[`${b.network_id}::${normalizeLookupKey(b.name)}`] = b.id;
      });

      for (const { task } of parsed) {
        const networkId = networkMap[normalizeLookupKey(task.networkName)];
        const branchKey = `${networkId}::${normalizeLookupKey(task.branchName)}`;
        if (branchMap[branchKey]) continue;
        const { data: created, error } = await supabase
          .from("branches")
          .insert({ name: task.branchName, network_id: networkId, city: task.branchCity, address: task.branchAddress })
          .select("id")
          .single();
        if (error) throw error;
        branchMap[branchKey] = created.id;
      }

      // Insert tasks one by one for row-level error tracking
      const batchPayloads: any[] = [];
      const batchMeta: typeof parsed = [];

      for (const item of parsed) {
        const { task, meta } = item;
        const networkId = networkMap[normalizeLookupKey(task.networkName)];
        const branchId = branchMap[`${networkId}::${normalizeLookupKey(task.branchName)}`];

        if (!branchId) {
          result.failed++;
          result.errors.push({ row: meta.rowNum, sheet: meta.sheet, reason: `סניף לא נמצא: ${task.branchName}` });
          const nKey = task.networkName;
          result.perNetwork[nKey] = result.perNetwork[nKey] || { imported: 0, failed: 0 };
          result.perNetwork[nKey].failed++;
          continue;
        }

        batchPayloads.push({
          branch_id: branchId,
          work_type: task.workType,
          executor: task.executorName,
          assigned_to: task.assignedTo,
          frequency: task.frequency,
          sides_required: task.sidesRequired,
          total_client_price: task.totalClientPrice,
          total_contractor_price: task.totalContractorPrice,
          due_date: task.dueDate,
          is_recurring: task.frequency !== "one_time",
          admin_notes: task.adminNotes,
          requires_photo: task.requiresPhoto,
          requires_video: task.requiresVideo,
        });
        batchMeta.push(item);
      }

      // Batch insert
      if (batchPayloads.length > 0) {
        const { error: taskError } = await supabase.from("tasks").insert(batchPayloads);
        if (taskError) {
          // If batch fails, try one by one
          console.warn("Batch insert failed, falling back to row-by-row:", taskError.message);
          for (let i = 0; i < batchPayloads.length; i++) {
            const { error: rowErr } = await supabase.from("tasks").insert(batchPayloads[i]);
            const nKey = batchMeta[i].task.networkName;
            result.perNetwork[nKey] = result.perNetwork[nKey] || { imported: 0, failed: 0 };
            if (rowErr) {
              result.failed++;
              result.errors.push({ row: batchMeta[i].meta.rowNum, sheet: batchMeta[i].meta.sheet, reason: rowErr.message });
              result.perNetwork[nKey].failed++;
            } else {
              result.imported++;
              result.perNetwork[nKey].imported++;
            }
          }
        } else {
          // All succeeded
          for (const item of batchMeta) {
            result.imported++;
            const nKey = item.task.networkName;
            result.perNetwork[nKey] = result.perNetwork[nKey] || { imported: 0, failed: 0 };
            result.perNetwork[nKey].imported++;
          }
        }
      }

      setImportResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks-export"] }),
      ]);

      if (result.failed === 0) {
        toast({ title: `יובאו ${result.imported} משימות בהצלחה` });
      } else {
        toast({ title: `יובאו ${result.imported} מתוך ${result.total}`, description: `${result.failed} שורות נכשלו`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "שגיאת ייבוא", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const rows = tasks.map((t: any) => ({
      "רשת": t.branches?.networks?.name || "", "סניף": t.branches?.name || "",
      "גורם מבצע": t.executor || "", "עיר": t.branches?.city || "",
      "סוג עבודה": t.work_type, "תדירות": t.frequency,
      "צדדים נדרשים": t.sides_required, "מחיר ללקוח": t.total_client_price,
      "מחיר לקבלן": t.total_contractor_price, "תאריך יעד": t.due_date, "סטטוס": t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משימות");
    XLSX.writeFile(wb, "yarok360_tasks.xlsx");
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תבנית ייבוא");
    XLSX.writeFile(wb, "yarok360_import_template.xlsx");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ייבוא / ייצוא</h1>
          <p className="text-muted-foreground text-sm mt-1">ייבוא משימות מאקסל או ייצוא נתונים</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-dashed border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                תבנית ייבוא
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">הורד קובץ אקסל ריק עם כותרות מוכנות לייבוא</p>
              <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
                <FileDown className="h-4 w-4 ml-2" />
                הורד תבנית אקסל לייבוא
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                ייבוא מאקסל
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">העלה קובץ אקסל עם כותרות תואמות לתבנית - הייבוא יתבצע אוטומטית</p>
              <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={importing}>
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                {importing ? "מייבא..." : "בחר קובץ לייבוא"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                ייצוא לאקסל
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">ייצא את כל המשימות לקובץ אקסל</p>
              <Button variant="outline" className="w-full" onClick={handleExport} disabled={tasks.length === 0}>
                <Download className="h-4 w-4 ml-2" />
                ייצא {tasks.length} משימות
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Import Summary */}
        {importResult && (
          <Card className={importResult.failed > 0 ? "border-destructive" : "border-green-500"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.failed > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                סיכום ייבוא
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold text-foreground">{importResult.total}</div>
                  <div className="text-xs text-muted-foreground">סה״כ שורות</div>
                </div>
                <div className="rounded-lg bg-green-500/10 p-3">
                  <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                  <div className="text-xs text-muted-foreground">יובאו בהצלחה</div>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3">
                  <div className="text-2xl font-bold text-destructive">{importResult.failed}</div>
                  <div className="text-xs text-muted-foreground">נכשלו</div>
                </div>
              </div>

              {/* Per-network breakdown */}
              {Object.keys(importResult.perNetwork).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">פירוט לפי רשת</h4>
                  <div className="space-y-1">
                    {Object.entries(importResult.perNetwork).map(([network, counts]) => (
                      <div key={network} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-1.5">
                        <span className="font-medium text-foreground">{network}</span>
                        <span className="text-muted-foreground">
                          <span className="text-green-600">{counts.imported} ✓</span>
                          {counts.failed > 0 && <span className="text-destructive mr-2"> {counts.failed} ✗</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error details */}
              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-destructive mb-2">שגיאות ({importResult.errors.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="flex gap-2 bg-destructive/5 rounded px-3 py-1.5 text-foreground">
                        <span className="text-muted-foreground whitespace-nowrap">גיליון: {err.sheet}, שורה {err.row}</span>
                        <span>—</span>
                        <span>{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
