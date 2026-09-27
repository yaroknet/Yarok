import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TeamTask } from "@/employees/hooks/useTeamTasks";
import { Badge } from "@/employees/components/ui/badge";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Button } from "@/employees/components/ui/button";
import { getTrafficLight } from "@/employees/lib/trafficLight";
import { CheckCircle2, MapPin, Camera, Mic, FileSignature, Clock, Play, User } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface HistoryTabProps {
  tasks: TeamTask[];
}

interface FieldReport {
  id: string;
  sides_completed: number;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
  signature_url: string | null;
  submitted_at: string;
}

interface ReportMedia {
  id: string;
  file_type: string;
  file_url: string;
}

// Extract storage path from a full URL or return as-is if already a path
function extractStoragePath(url: string): string {
  // If it's a full URL, extract the path
  const match = url.match(/\/object\/(?:public|sign)\/field-media\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  const match2 = url.match(/field-media\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  // If it doesn't look like a URL, it's already a path
  if (!url.startsWith("http")) return url;
  return url;
}

export function HistoryTab({ tasks }: HistoryTabProps) {
  const { user } = useAuth();
  const completed = tasks.filter((t) => t.status === "completed" || t.status === "cancelled");
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);

  const { data: reportData } = useQuery({
    queryKey: ["task-report", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask || !user) return null;
      const { data: reports } = await supabase
        .from("field_reports")
        .select("*")
        .eq("task_id", selectedTask.id)
        .eq("reported_by", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1);

      if (!reports || reports.length === 0) return null;
      const report = reports[0] as FieldReport;

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
            .createSignedUrl(path, 3600); // 1 hour
          return { ...m, file_url: data?.signedUrl || m.file_url };
        })
      );

      return { report, media: mediaWithSignedUrls as ReportMedia[] };
    },
    enabled: !!selectedTask && !!user,
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

  return (
    <div className="px-4 pb-24 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-foreground">ארכיון משימות</h2>
        <span className="text-sm text-muted-foreground">{completed.length} משימות</span>
      </div>

      {completed.length === 0 ? (
        <div className="bg-card rounded-2xl border shadow-card p-8 text-center">
          <p className="text-muted-foreground">אין משימות שהושלמו עדיין</p>
        </div>
      ) : (
        completed.map((t) => {
          const traffic = getTrafficLight(t.status, t.due_date, t.frequency);
          return (
            <Card
              key={t.id}
              className="shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setSelectedTask(t)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t.branches?.networks?.name} — {t.branches?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.work_type}</p>
                    </div>
                  </div>
                  <Badge className={traffic.className}>{traffic.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Report Detail Dialog - Read Only */}
      <Dialog open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {selectedTask?.branches?.networks?.name} — {selectedTask?.branches?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-right">{selectedTask?.work_type}</p>
          </DialogHeader>

          {reportData ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>הוגש ב: {format(parseISO(reportData.report.submitted_at), "dd/MM/yyyy HH:mm")}</span>
              </div>

              {/* Customer name extracted from notes */}
              {(() => {
                const notesRaw = reportData.report.notes || "";
                const clientMatch = notesRaw.match(/\[שם לקוח:\s*(.+?)\]/);
                const clientName = clientMatch ? clientMatch[1] : null;
                const cleanNotes = notesRaw.replace(/\[שם לקוח:\s*.+?\]\n?/, "").trim();
                return (
                  <>
                    <div className="bg-primary/10 rounded-xl p-3 flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <span><span className="font-bold">שם הלקוח: </span>{clientName || "לא צוין"}</span>
                    </div>

                    {reportData.report.gps_lat && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-emerald-600" />
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
                  </>
                );
              })()}

              {/* Customer satisfaction audio - always shown */}
              <div>
                <p className="text-sm font-bold mb-2 flex items-center gap-1">
                  <Mic className="h-4 w-4" /> הקלטת שביעות רצון לקוח
                </p>
                {reportData.media.filter((m) => m.file_type === "audio").length > 0 ? (
                  reportData.media
                    .filter((m) => m.file_type === "audio")
                    .map((m) => (
                      <div key={m.id} className="space-y-2">
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
              {reportData.media.filter((m) => m.file_type === "photo").length > 0 && (
                <div>
                  <p className="text-sm font-bold mb-2 flex items-center gap-1">
                    <Camera className="h-4 w-4" /> תמונות
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {reportData.media
                      .filter((m) => m.file_type === "photo")
                      .map((m) => (
                        <img
                          key={m.id}
                          src={m.file_url}
                          className="rounded-lg object-cover aspect-square w-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ))}
                  </div>
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">אין נתוני דיווח זמינים</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
