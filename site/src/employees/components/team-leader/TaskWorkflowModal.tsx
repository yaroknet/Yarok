import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Button } from "@/employees/components/ui/button";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Textarea } from "@/employees/components/ui/textarea";
import { Input } from "@/employees/components/ui/input";
import { Badge } from "@/employees/components/ui/badge";
import {
  Camera, Video, Mic, MicOff, MapPin, AlertTriangle, CheckCircle2,
  Loader2, X, Play, Square, FileText
} from "lucide-react";
import { TeamTask } from "@/employees/hooks/useTeamTasks";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TaskWorkflowModalProps {
  task: TeamTask | null;
  open: boolean;
  onClose: () => void;
}

export function TaskWorkflowModal({ task, open, onClose }: TaskWorkflowModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"notes" | "report">("notes");
  const [acked, setAcked] = useState(false);
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [sidesCompleted, setSidesCompleted] = useState(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isVitrinas = task?.work_type?.includes("ויטרינ");

  useEffect(() => {
    if (open && task) {
      setStep(task.admin_notes ? "notes" : "report");
      setAcked(false);
      setNotes("");
      setClientName("");
      setSidesCompleted(task.sides_required);
      setPhotos([]);
      setVideos([]);
      setAudioBlob(null);
      setSignatureData(null);
      setGps(null);
      setGpsError(false);
      setIsRecording(false);
      setRecordingTime(0);
      requestGPS();
    }
  }, [open, task]);

  const requestGPS = () => {
    if (!navigator.geolocation) {
      setGpsError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("לא ניתן לגשת למיקרופון");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  };

  useEffect(() => {
    if (step === "report") {
      setTimeout(initCanvas, 100);
    }
  }, [step]);

  const getCanvasPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onPointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const onPointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    setSignatureData(null);
    initCanvas();
  };

  const canSubmit = () => {
    if (!gps) return false;
    if (task?.requires_photo && photos.length === 0) return false;
    if (!signatureData) return false;
    if (!clientName.trim()) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!task || !user || !gps) return;
    setSubmitting(true);
    try {
      const { data: report, error: reportErr } = await supabase
        .from("field_reports")
        .insert({
          task_id: task.id,
          reported_by: user.id,
          sides_completed: isVitrinas ? sidesCompleted : task.sides_required,
          gps_lat: gps.lat,
          gps_lng: gps.lng,
          notes: `[שם מלא של החתום: ${clientName.trim()}]\n${notes}`.trim(),
          signature_url: signatureData,
        })
        .select("id")
        .single();

      if (reportErr) throw reportErr;

      const uploadFile = async (file: File | Blob, type: string, ext: string) => {
        const path = `${report.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("field-media")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        // Store the path (not public URL) since bucket is private
        await supabase.from("report_media").insert({
          field_report_id: report.id,
          file_type: type,
          file_url: path,
        });
      };

      for (const photo of photos) await uploadFile(photo, "photo", "jpg");
      for (const video of videos) await uploadFile(video, "video", "mp4");
      if (audioBlob) await uploadFile(audioBlob, "audio", "webm");

      await supabase.from("tasks").update({ status: "completed" }).eq("id", task.id);

      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("הדיווח נשלח בהצלחה!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשליחת הדיווח");
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-right text-lg">
            {task.branches?.networks?.name} — {task.branches?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-right">{task.work_type}</p>
        </DialogHeader>

        {step === "notes" && task.admin_notes && (
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-bold text-amber-800 dark:text-amber-300">דגשים והערות לביצוע</span>
              </div>
              <p className="text-base font-bold text-foreground whitespace-pre-wrap leading-relaxed">
                {task.admin_notes}
              </p>
            </div>

            <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
              <Checkbox
                id="ack-notes"
                checked={acked}
                onCheckedChange={(v) => setAcked(!!v)}
                className="mt-0.5 h-5 w-5"
              />
              <label htmlFor="ack-notes" className="text-sm font-semibold cursor-pointer select-none">
                קראתי את הדגשים ואני מתחייב לבצעם
              </label>
            </div>

            <Button
              className="w-full h-14 text-base font-bold rounded-xl"
              disabled={!acked}
              onClick={() => setStep("report")}
            >
              <Play className="h-5 w-5 ml-2" />
              התחל משימה
            </Button>
          </div>
        )}

        {step === "report" && (
          <div className="p-4 space-y-5">
            {/* GPS Status */}
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
              gps ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : gpsError ? "bg-red-50 dark:bg-red-950/30 text-destructive" : "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
            }`}>
              <MapPin className="h-5 w-5 shrink-0" />
              {gps ? (
                <span>מיקום נלכד: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
              ) : gpsError ? (
                <div>
                  <p>נא לאשר גישה למיקום כדי לשלוח דיווח</p>
                  <Button variant="link" size="sm" onClick={requestGPS} className="text-destructive p-0 h-auto">
                    נסה שוב
                  </Button>
                </div>
              ) : (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מחפש מיקום...
                </span>
              )}
            </div>

            {/* Sides completed - only for Vitrinas */}
            {isVitrinas && (
              <div>
                <label className="text-sm font-bold mb-2 block">כמות צדדים שבוצעו</label>
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-12 w-12 rounded-xl text-xl"
                    onClick={() => setSidesCompleted(Math.max(1, sidesCompleted - 1))}
                  >
                    −
                  </Button>
                  <span className="text-2xl font-bold min-w-[3ch] text-center">{sidesCompleted}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-12 w-12 rounded-xl text-xl"
                    onClick={() => setSidesCompleted(sidesCompleted + 1)}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">מתוך {task.sides_required}</span>
                </div>
              </div>
            )}

            {/* Photo capture */}
            <div>
              <label className="text-sm font-bold mb-2 flex items-center gap-1">
                <Camera className="h-4 w-4" />
                צילום תמונות
                {task.requires_photo && <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>}
              </label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
              <Button
                variant="outline"
                className="w-full h-14 rounded-xl text-base"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="h-5 w-5 ml-2" />
                צלם תמונה ({photos.length})
              </Button>
              {photos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative shrink-0">
                      <img src={URL.createObjectURL(p)} className="h-16 w-16 object-cover rounded-lg" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* Video capture */}
            {task.requires_video && (
              <div>
                <label className="text-sm font-bold mb-2 flex items-center gap-1">
                  <Video className="h-4 w-4" />
                  צילום וידאו
                  <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>
                </label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setVideos((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-xl text-base"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="h-5 w-5 ml-2" />
                  צלם וידאו ({videos.length})
                </Button>
              </div>
            )}

            {/* Audio recording */}
            <div>
              <label className="text-sm font-bold mb-2 flex items-center gap-1">
                <Mic className="h-4 w-4" />
                הקלטת שביעות רצון לקוח
                <Badge variant="secondary" className="text-[10px] mr-1">אופציונלי</Badge>
              </label>
              {isRecording ? (
                <Button
                  variant="destructive"
                  className="w-full h-14 rounded-xl text-base animate-pulse"
                  onClick={stopRecording}
                >
                  <Square className="h-5 w-5 ml-2" />
                  הפסק הקלטה ({Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")})
                  <span className="mr-2 h-3 w-3 rounded-full bg-white animate-ping" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className={`w-full h-14 rounded-xl text-base ${audioBlob ? "border-emerald-400 text-emerald-700" : ""}`}
                  onClick={audioBlob ? () => setAudioBlob(null) : startRecording}
                >
                  {audioBlob ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 ml-2 text-emerald-500" />
                      הקלטה נשמרה — לחץ לצלם מחדש
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 ml-2" />
                      התחל הקלטה
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Client Name + Signature */}
            <div>
              <label className="text-sm font-bold mb-2 block">
                שם מלא של החתום
                <Badge variant="destructive" className="text-[10px] mr-2">חובה</Badge>
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="הזן את שם מלא של החתום..."
                className="rounded-xl h-12 text-base"
              />
            </div>

            <div>
              <label className="text-sm font-bold mb-2 flex items-center gap-1">
                חתימת לקוח דיגיטלית
                <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>
              </label>
              <div className="border-2 border-dashed border-border rounded-xl overflow-hidden relative bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full touch-none"
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                />
                {signatureData && (
                  <button
                    onClick={clearSignature}
                    className="absolute top-2 left-2 bg-muted rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">חתום עם האצבע או העכבר</p>
            </div>

            {/* Notes - moved to bottom */}
            <div>
              <label className="text-sm font-bold mb-2 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                הערות מבצע
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות חופשיות..."
                className="rounded-xl min-h-[80px]"
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full h-14 text-base font-bold rounded-xl"
              disabled={!canSubmit() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin ml-2" />
              ) : (
                <CheckCircle2 className="h-5 w-5 ml-2" />
              )}
              {submitting ? "שולח דיווח..." : "שלח דיווח"}
            </Button>

            {!canSubmit() && (
              <p className="text-xs text-destructive text-center">
                {!gps && "⚠️ נדרש אישור מיקום · "}
                {task.requires_photo && photos.length === 0 && "⚠️ נדרשת תמונה · "}
                {!clientName.trim() && "⚠️ נדרש שם מלא של החתום · "}
                {!signatureData && "⚠️ נדרשת חתימה"}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
