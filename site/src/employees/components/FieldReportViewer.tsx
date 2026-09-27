import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { MapPin, Camera, Mic, FileSignature, Clock, Play, Video, User } from "lucide-react";
import { Button } from "@/employees/components/ui/button";
import { toast } from "sonner";

interface FieldReportViewerProps {
  taskId: string;
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

function extractStoragePath(url: string): string {
  const match = url.match(/\/object\/(?:public|sign)\/field-media\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  const match2 = url.match(/field-media\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  if (!url.startsWith("http")) return url;
  return url;
}

export function FieldReportViewer({ taskId }: FieldReportViewerProps) {
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["admin-task-report", taskId],
    queryFn: async () => {
      // Get ALL reports for this task (not filtered by user)
      const { data: reports } = await supabase
        .from("field_reports")
        .select("*")
        .eq("task_id", taskId)
        .order("submitted_at", { ascending: false })
        .limit(1);

      if (!reports || reports.length === 0) return null;
      const report = reports[0] as FieldReport;

      // Get reporter name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", report.reported_by)
        .single();

      const { data: media } = await supabase
        .from("report_media")
        .select("*")
        .eq("field_report_id", report.id);

      // Generate signed URLs for all media
      const mediaWithSignedUrls = await Promise.all(
        (media || []).map(async (m: ReportMedia) => {
          const path = extractStoragePath(m.file_url);
          const { data } = await supabase.storage
            .from("field-media")
            .createSignedUrl(path, 3600);
          return { ...m, file_url: data?.signedUrl || m.file_url };
        })
      );

      return {
        report,
        reporterName: profile?.full_name || "לא ידוע",
        media: mediaWithSignedUrls as ReportMedia[],
      };
    },
    enabled: !!taskId,
  });

  const handlePlayAudio = async (url: string) => {
    const audio = new Audio(url);
    audio.onerror = () => toast.error("לא ניתן להשמיע את ההקלטה");
    try {
      await audio.play();
    } catch {
      toast.error("השמעה נכשלה");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-8">טוען דיווח...</p>;
  }

  if (!reportData) {
    return <p className="text-sm text-muted-foreground text-center py-8">אין דיווח שטח למשימה זו</p>;
  }

  const photos = reportData.media.filter((m) => m.file_type === "photo");
  const videos = reportData.media.filter((m) => m.file_type === "video");
  const audios = reportData.media.filter((m) => m.file_type === "audio");

  // Extract customer name from notes (format: [שם לקוח: NAME]\nrest)
  const notesRaw = reportData.report.notes || "";
  const clientMatch = notesRaw.match(/\[(?:שם לקוח|שם מלא של החתום):\s*(.+?)\]/);
  const clientName = clientMatch ? clientMatch[1] : null;
  const cleanNotes = notesRaw.replace(/\[(?:שם לקוח|שם מלא של החתום):\s*.+?\]\n?/, "").trim();

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>הוגש ב: {format(parseISO(reportData.report.submitted_at), "dd/MM/yyyy HH:mm")}</span>
      </div>

      <div className="bg-muted/50 rounded-xl p-3 text-sm">
        <span className="font-bold">דווח על ידי: </span>
        {reportData.reporterName}
      </div>

      {/* Customer name - always shown */}
      <div className="bg-primary/10 rounded-xl p-3 flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-primary shrink-0" />
        <span><span className="font-bold">שם מלא של החתום: </span>{clientName || "לא צוין"}</span>
      </div>

      {reportData.report.gps_lat && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>מיקום: {reportData.report.gps_lat.toFixed(5)}, {reportData.report.gps_lng?.toFixed(5)}</span>
        </div>
      )}

      <div className="bg-muted/50 rounded-xl p-3 text-sm">
        <span className="font-bold">צדדים שבוצעו: </span>
        {reportData.report.sides_completed}
      </div>

      {cleanNotes && (
        <div className="bg-muted/50 rounded-xl p-3 text-sm">
          <p className="font-bold mb-1">הערות מבצע:</p>
          <p className="whitespace-pre-wrap">{cleanNotes}</p>
        </div>
      )}

      {/* Customer satisfaction audio - always shown prominently */}
      <div>
        <p className="text-sm font-bold mb-2 flex items-center gap-1">
          <Mic className="h-4 w-4" /> הקלטת שביעות רצון לקוח
        </p>
        {audios.length > 0 ? (
          audios.map((m) => (
            <div key={m.id} className="space-y-2 mb-2">
              <audio src={m.file_url} controls className="w-full" />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => handlePlayAudio(m.file_url)}
              >
                <Play className="h-4 w-4" />
                השמע הקלטה
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">לא צורפה הקלטה</p>
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2 flex items-center gap-1">
            <Camera className="h-4 w-4" /> תמונות ({photos.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((m) => (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={m.file_url}
                  className="rounded-lg object-cover aspect-square w-full cursor-pointer hover:opacity-80 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2 flex items-center gap-1">
            <Video className="h-4 w-4" /> וידאו ({videos.length})
          </p>
          {videos.map((m) => (
            <video key={m.id} src={m.file_url} controls className="w-full rounded-lg mb-2" />
          ))}
        </div>
      )}


      {/* Signature */}
      {reportData.report.signature_url && (
        <div>
          <p className="text-sm font-bold mb-2 flex items-center gap-1">
            <FileSignature className="h-4 w-4" /> חתימה
          </p>
          <img src={reportData.report.signature_url} className="border rounded-xl bg-white max-h-32" />
        </div>
      )}
    </div>
  );
}
