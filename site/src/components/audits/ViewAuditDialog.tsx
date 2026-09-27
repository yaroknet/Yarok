import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import {
  AREA_CLEANING_ITEMS,
  EQUIPMENT_ITEMS,
  SATISFACTION_QUESTIONS,
} from "@/lib/superPharmBranches";

export interface AuditRecord {
  id: string;
  audit_date: string;
  area_manager_name: string;
  branch_name: string;
  cleaner_name: string | null;
  area_ratings: Record<string, number>;
  equipment_status: Record<string, "good" | "bad">;
  area_manager_notes: string | null;
  branch_manager_name: string | null;
  branch_manager_role: string | null;
  satisfaction_ratings: Record<string, number>;
  customer_notes: string | null;
  branch_manager_signature: string | null;
  area_manager_signature: string | null;
  average_area_score: number | null;
  average_satisfaction_score: number | null;
  created_at: string;
}

interface Props {
  audit: AuditRecord | null;
  onClose: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const ViewAuditDialog = ({ audit, onClose }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    if (!contentRef.current || !audit) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const pages = contentRef.current.querySelectorAll<HTMLElement>("[data-pdf-page]");
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff" });
        const ratio = canvas.width / canvas.height;
        const pageRatio = pageWidth / pageHeight;
        let w = pageWidth;
        let h = pageWidth / ratio;
        if (h > pageHeight) {
          h = pageHeight;
          w = pageHeight * ratio;
        }
        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, w, h);
      }
      pdf.save(`audit-${audit.branch_name}-${audit.id.slice(0, 8)}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (!audit) return null;

  return (
    <Dialog open={!!audit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0" dir="rtl">
        <DialogHeader className="sticky top-0 z-10 bg-background border-b px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pl-8">
            <DialogTitle className="text-base sm:text-lg truncate min-w-0 flex-1">
              ביקורת - {audit.branch_name}
            </DialogTitle>
            <Button size="sm" onClick={downloadPdf} disabled={downloading} className="gap-1 shrink-0">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              הורדת PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="px-4 pb-4 sm:px-6">


        <div
          ref={contentRef}
          dir="rtl"
          className="bg-white text-black"
          style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" }}
        >
          <style>{`
            [data-pdf-page] { width: 210mm; min-height: 297mm; padding: 12mm 15mm; box-sizing: border-box; background:#fff; page-break-after: always; break-after: page; }
            [data-pdf-page]:last-child { page-break-after: auto; break-after: auto; }
            .pdf-table { width:100%; border-collapse: collapse; font-size:13px; }
            .pdf-table th, .pdf-table td { border:1px solid #e2e8f0; padding:6px 10px; text-align:right; }
            .pdf-table thead th { background:#f1f5f9; font-weight:700; }
            .pdf-row-avoid { page-break-inside: avoid; break-inside: avoid; }
            .pdf-section-title { font-size:15px; font-weight:700; background:#f1f5f9; padding:8px 10px; border-radius:4px; margin-bottom:10px; border:1px solid #e2e8f0; }
            .pdf-header { text-align:center; border-bottom:2px solid #14532d; padding-bottom:10px; margin-bottom:12px; }
            .pdf-header h2 { font-size:20px; font-weight:700; color:#14532d; margin:0; }
            .pdf-header p { font-size:12px; color:#475569; margin:4px 0 0; }
            .pdf-meta { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; font-size:13px; margin-bottom:10px; }
            .pdf-notes { border:1px solid #e2e8f0; border-radius:4px; padding:8px; margin-top:8px; font-size:12px; white-space:pre-wrap; page-break-inside: avoid; break-inside: avoid; }
            .pdf-sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; page-break-inside: avoid; break-inside: avoid; }
            .pdf-sig-card { border:1px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff; page-break-inside: avoid; break-inside: avoid; }
            .pdf-sig-card .lbl { font-size:12px; font-weight:700; margin-bottom:6px; }
            .pdf-sig-card .box { border:1px solid #e2e8f0; border-radius:4px; background:#fff; height:70px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
            .pdf-sig-card .box img { max-height:70px; max-width:100%; object-fit:contain; }
            .pdf-sig-card .name { font-size:11px; margin-top:6px; color:#334155; }
          `}</style>

          {/* Page 1 */}
          <div data-pdf-page>
            <div className="pdf-header">
              <h2>דוח ביקורת מנהל אזור</h2>
              <p>{audit.branch_name} · {formatDate(audit.audit_date)}</p>
            </div>

            <div className="pdf-section-title">עמוד 1: בקרת מנהל אזור (בדיקה פיזית ומלאי)</div>

            <div className="pdf-meta">
              <div><b>מנהל/ת האזור:</b> {audit.area_manager_name}</div>
              <div><b>סניף:</b> {audit.branch_name}</div>
              <div><b>תאריך ושעה:</b> {formatDate(audit.audit_date)}</div>
              <div><b>עובד/ת ניקיון:</b> {audit.cleaner_name || "-"}</div>
            </div>

            <table className="pdf-table">
              <thead>
                <tr>
                  <th>אזור</th>
                  <th style={{ width: 170, textAlign: "center" }}>סטטוס</th>
                  <th style={{ width: 180 }}>הערות</th>
                </tr>
              </thead>
              <tbody>
                {AREA_CLEANING_ITEMS.map((i) => {
                  const v: any = audit.area_ratings?.[i.key];
                  const notes: any = (audit.area_ratings as any)?._notes || {};
                  const label =
                    v === "clean" || v === 1 || v === true
                      ? "נקי"
                      : v === "not_clean" || v === 0 || v === false
                      ? "לא נקי (הועבר לביצוע העובד)"
                      : typeof v === "number"
                      ? String(v)
                      : "-";
                  return (
                    <tr key={i.key} className="pdf-row-avoid">
                      <td>{i.label}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{label}</td>
                      <td style={{ fontSize: 11, color: "#334155", whiteSpace: "pre-wrap" }}>
                        {notes?.[i.key] || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>


            <div className="pdf-section-title" style={{ marginTop: 12 }}>ציוד ומלאי</div>
            <table className="pdf-table">
              <tbody>
                {EQUIPMENT_ITEMS.map((i) => {
                  const v = audit.equipment_status?.[i.key];
                  return (
                    <tr key={i.key} className="pdf-row-avoid">
                      <td>{i.label}</td>
                      <td style={{ width: 120, textAlign: "center", fontWeight: 700 }}>
                        {v === "good" ? i.goodLabel : v === "bad" ? i.badLabel : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {audit.area_manager_notes && (
              <div className="pdf-notes">
                <b>הערות מנהל האזור:</b>
                <div>{audit.area_manager_notes}</div>
              </div>
            )}
          </div>

          {/* Page 2 */}
          <div data-pdf-page style={{ pageBreakBefore: "always", breakBefore: "page" }}>
            <div className="pdf-header">
              <h2>סקר שביעות רצון לקוח</h2>
              <p>{audit.branch_name} · {formatDate(audit.audit_date)}</p>
            </div>

            <div className="pdf-section-title">עמוד 2: סקר שביעות רצון לקוח</div>

            <div className="pdf-meta">
              <div><b>שם נציג הסניף:</b> {audit.branch_manager_name || "-"}</div>
              <div><b>תפקיד:</b> {audit.branch_manager_role || "-"}</div>
            </div>

            <table className="pdf-table">
              <thead>
                <tr>
                  <th>שאלה</th>
                  <th style={{ width: 90, textAlign: "center" }}>ציון (1-5)</th>
                </tr>
              </thead>
              <tbody>
                {SATISFACTION_QUESTIONS.map((q) => (
                  <tr key={q.key} className="pdf-row-avoid">
                    <td>{q.label}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {audit.satisfaction_ratings?.[q.key] ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 6, fontSize: 13 }}>
              <b>ממוצע שביעות רצון:</b> {audit.average_satisfaction_score ?? "-"} / 5
            </p>

            {audit.customer_notes && (
              <div className="pdf-notes">
                <b>הערות הלקוח:</b>
                <div>{audit.customer_notes}</div>
              </div>
            )}

            <div className="pdf-sig-grid">
              <div className="pdf-sig-card">
                <div className="lbl">חתימת מנהל האזור</div>
                <div className="box">
                  {audit.area_manager_signature ? (
                    <img src={audit.area_manager_signature} alt="חתימת מנהל אזור" />
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>ללא חתימה</span>
                  )}
                </div>
                <div className="name">{audit.area_manager_name}</div>
              </div>
              <div className="pdf-sig-card">
                <div className="lbl">חתימת מנהל/ת הסניף</div>
                <div className="box">
                  {audit.branch_manager_signature ? (
                    <img src={audit.branch_manager_signature} alt="חתימת מנהל סניף" />
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>ללא חתימה</span>
                  )}
                </div>
                <div className="name">{audit.branch_manager_name || "-"}</div>
              </div>
            </div>
          </div>
        </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
