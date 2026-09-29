import jsPDF from "jspdf";
import { supabase } from "@/employees/integrations/supabase/client";
import yarokLogoUrl from "@/employees/assets/yarok-logo.png";
import { RubikRegularBase64 } from "@/employees/lib/Rubik-Regular-base64";
import { RubikBoldBase64 } from "@/employees/lib/Rubik-Bold-base64";

interface ReportTask {
  id: string;
  work_type: string;
  sides_required: number;
  due_date: string | null;
  status: string;
  branches: {
    name: string;
    networks: { name: string };
  };
}

interface FieldReport {
  id: string;
  sides_completed: number;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
  signature_url: string | null;
  submitted_at: string;
  reported_by: string;
}

interface ReportMedia {
  id: string;
  file_type: string;
  file_url: string;
}

const SIDES_WORK_TYPES = ["ויטרינות", "הסרת מדבקה מויטרינה + ניקיון ויטרינה"];

function extractStoragePath(url: string): string {
  const match = url.match(/\/object\/(?:public|sign)\/field-media\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  const match2 = url.match(/field-media\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  if (!url.startsWith("http")) return url;
  return url;
}

async function loadLogoBase64(): Promise<string> {
  const response = await fetch(yarokLogoUrl);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// Reverse Hebrew text for jsPDF (which doesn't support RTL natively)
function reverseHebrew(text: string): string {
  // Split by segments: Hebrew/RTL vs LTR (numbers, latin)
  const segments: { text: string; isRtl: boolean }[] = [];
  let current = "";
  let currentIsRtl = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    // Hebrew range + Arabic range + common RTL punctuation
    const isRtl = (code >= 0x0590 && code <= 0x05FF) || (code >= 0x0600 && code <= 0x06FF);
    const isNeutral = /[\s:.,;!?@#$%^&*()_+\-=\[\]{}|\\/<>'"״׳–—]/.test(char);

    if (current === "") {
      currentIsRtl = isRtl || isNeutral;
      current = char;
    } else if (isNeutral || isRtl === currentIsRtl) {
      current += char;
    } else {
      segments.push({ text: current, isRtl: currentIsRtl });
      current = char;
      currentIsRtl = isRtl;
    }
  }
  if (current) segments.push({ text: current, isRtl: currentIsRtl });

  // Reverse the order of segments (RTL base direction) and reverse RTL segment chars
  const reversed = segments.reverse().map(seg => {
    if (seg.isRtl) {
      return seg.text.split("").reverse().join("");
    }
    return seg.text;
  });

  return reversed.join("");
}

function setupFonts(doc: jsPDF) {
  doc.addFileToVFS("Rubik-Regular.ttf", RubikRegularBase64);
  doc.addFileToVFS("Rubik-Bold.ttf", RubikBoldBase64);
  doc.addFont("Rubik-Regular.ttf", "Rubik", "normal");
  doc.addFont("Rubik-Bold.ttf", "Rubik", "bold");
  doc.setFont("Rubik", "normal");
}

async function fetchReportData(taskId: string) {
  const { data: reports } = await supabase
    .from("field_reports")
    .select("*")
    .eq("task_id", taskId)
    .order("submitted_at", { ascending: false })
    .limit(1);

  if (!reports || reports.length === 0) return null;
  const report = reports[0] as FieldReport;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", report.reported_by)
    .single();

  const { data: media } = await supabase
    .from("report_media")
    .select("*")
    .eq("field_report_id", report.id);

  const mediaWithUrls = await Promise.all(
    (media || []).map(async (m: ReportMedia) => {
      const path = extractStoragePath(m.file_url);
      const { data } = await supabase.storage
        .from("field-media")
        .createSignedUrl(path, 3600);
      return { ...m, file_url: data?.signedUrl || m.file_url };
    })
  );

  const notesRaw = report.notes || "";
  const clientMatch = notesRaw.match(/\[שם לקוח:\s*(.+?)\]/);
  const clientName = clientMatch ? clientMatch[1] : "לא צוין";
  const cleanNotes = notesRaw.replace(/\[שם לקוח:\s*.+?\]\n?/, "").trim();

  return {
    report,
    reporterName: profile?.full_name || "לא ידוע",
    clientName,
    cleanNotes,
    photos: mediaWithUrls.filter((m) => m.file_type === "photo"),
    audios: mediaWithUrls.filter((m) => m.file_type === "audio"),
    videos: mediaWithUrls.filter((m) => m.file_type === "video"),
  };
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function addHebrewText(doc: jsPDF, text: string, x: number, y: number, options?: { fontSize?: number; bold?: boolean; color?: [number, number, number]; maxWidth?: number }) {
  const { fontSize = 11, bold = false, color = [33, 33, 33], maxWidth } = options || {};
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  doc.setFont("Rubik", bold ? "bold" : "normal");

  const reversed = reverseHebrew(text);
  if (maxWidth) {
    doc.text(reversed, x, y, { align: "right", maxWidth });
  } else {
    doc.text(reversed, x, y, { align: "right" });
  }
}

async function renderTaskPage(
  doc: jsPDF,
  task: ReportTask,
  logoBase64: string,
  includePhotos: boolean,
  isFirstPage: boolean
) {
  if (!isFirstPage) doc.addPage();

  const pageWidth = doc.internal.pageSize.getWidth();
  const rightMargin = pageWidth - 15;

  // Logo
  try {
    doc.addImage(logoBase64, "PNG", pageWidth - 55, 8, 40, 20);
  } catch { /* skip logo if failed */ }

  // Title
  let y = 35;
  const title = `דוח שטח - ${task.branches?.networks?.name} - ${task.branches?.name}`;
  addHebrewText(doc, title, rightMargin, y, { fontSize: 16, bold: true, color: [0, 100, 0] });
  y += 8;

  // Separator line
  doc.setDrawColor(0, 100, 0);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 10;

  const reportData = await fetchReportData(task.id);
  if (!reportData) {
    addHebrewText(doc, "אין דיווח שטח זמין למשימה זו", rightMargin, y, { fontSize: 12, color: [150, 150, 150] });
    return;
  }

  const { report, reporterName, clientName, cleanNotes, photos } = reportData;

  // Info rows
  const rows: [string, string][] = [
    ["רשת:", task.branches?.networks?.name || "—"],
    ["סניף:", task.branches?.name || "—"],
    ["תאריך ושעה:", formatDate(report.submitted_at)],
    ["דווח על ידי:", reporterName],
    ["שם הלקוח:", clientName],
  ];

  if (report.gps_lat) {
    rows.push(["מיקום:", `${report.gps_lat.toFixed(5)}, ${report.gps_lng?.toFixed(5)}`]);
  }

  if (SIDES_WORK_TYPES.includes(task.work_type)) {
    rows.push(["כמות צדדים שבוצעו:", String(report.sides_completed)]);
  }

  rows.push(["סוג עבודה:", task.work_type]);

  for (const [label, value] of rows) {
    addHebrewText(doc, `${label} ${value}`, rightMargin, y, { fontSize: 11 });
    y += 7;
  }

  // Notes section removed per client request

  // Signature
  if (report.signature_url) {
    y += 4;
    addHebrewText(doc, "חתימת לקוח:", rightMargin, y, { fontSize: 11, bold: true, color: [0, 100, 0] });
    y += 5;
    try {
      const sigBase64 = await loadImageAsBase64(report.signature_url);
      if (sigBase64) {
        doc.addImage(sigBase64, "PNG", pageWidth - 75, y, 60, 25);
        y += 30;
      }
    } catch { /* skip */ }
  }

  // Audio/video notes
  if (reportData.audios.length > 0) {
    y += 4;
    addHebrewText(doc, `הקלטת שביעות רצון לקוח: ${reportData.audios.length} קבצים (זמינים במערכת)`, rightMargin, y, { fontSize: 10, color: [100, 100, 100] });
    y += 7;
  }

  if (reportData.videos.length > 0) {
    addHebrewText(doc, `קבצי וידאו: ${reportData.videos.length} קבצים (זמינים במערכת)`, rightMargin, y, { fontSize: 10, color: [100, 100, 100] });
    y += 7;
  }

  // Photos (optional)
  if (includePhotos && photos.length > 0) {
    y += 4;
    addHebrewText(doc, `תמונות (${photos.length}):`, rightMargin, y, { fontSize: 11, bold: true, color: [0, 100, 0] });
    y += 8;

    for (const photo of photos) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      try {
        const imgBase64 = await loadImageAsBase64(photo.file_url);
        if (imgBase64) {
          doc.addImage(imgBase64, "JPEG", 15, y, 80, 60);
          y += 65;
        }
      } catch { /* skip */ }
    }
  }
}

export async function generateTaskPdf(tasks: ReportTask[], includePhotos: boolean): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  let logoBase64 = "";
  try {
    logoBase64 = await loadLogoBase64();
  } catch { /* proceed without logo */ }

  // Individual task pages only (no cover page)

  // Individual task pages
  for (let i = 0; i < tasks.length; i++) {
    await renderTaskPage(doc, tasks[i], logoBase64, includePhotos, i === 0);
  }

  return doc.output("blob");
}

export async function markTasksSentToClient(taskIds: string[]) {
  const { error } = await supabase
    .from("tasks")
    .update({ sent_to_client_at: new Date().toISOString() } as any)
    .in("id", taskIds);
  if (error) throw error;
}
