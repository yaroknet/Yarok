import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Textarea } from "@/employees/components/ui/textarea";
import { Badge } from "@/employees/components/ui/badge";
import { Calendar } from "@/employees/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import {
  Camera, CheckCircle2, X, Loader2, AlertTriangle, FileText,
  CalendarIcon, ClipboardList, Video,
} from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/employees/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface ServiceStartProofFormProps {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
}

export function ServiceStartProofForm({
  open,
  onClose,
  serviceId,
  serviceName,
}: ServiceStartProofFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [trianglePhoto, setTrianglePhoto] = useState<File | null>(null);
  const [barcodePhoto, setBarcodePhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
  const [extraVideos, setExtraVideos] = useState<File[]>([]);
  const [workStartDate, setWorkStartDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = trianglePhoto && barcodePhoto && workStartDate;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const uploadFile = async (file: File | Blob, label: string, ext: string) => {
        const path = `service-proofs/${serviceId}/${label}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("field-media").upload(path, file);
        if (error) throw error;
        return path;
      };

      const trianglePath = await uploadFile(trianglePhoto!, "triangle", "jpg");
      const barcodePath = await uploadFile(barcodePhoto!, "barcode", "jpg");

      const photoPaths: string[] = [];
      for (const p of extraPhotos) {
        photoPaths.push(await uploadFile(p, "photo", "jpg"));
      }

      const videoPaths: string[] = [];
      for (const v of extraVideos) {
        videoPaths.push(await uploadFile(v, "video", "mp4"));
      }

      const { error } = await supabase.from("service_start_proofs").insert({
        service_id: serviceId,
        submitted_by: user.id,
        triangle_photo_url: trianglePath,
        barcode_photo_url: barcodePath,
        work_start_date: workStartDate!.toISOString().split("T")[0],
        notes: notes || null,
        extra_photos: photoPaths,
        extra_videos: videoPaths,
      } as any);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service-start-proofs"] });
      queryClient.invalidateQueries({ queryKey: ["pending-service-proofs"] });
      toast.success("הטופס נשלח בהצלחה!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            טופס תחילת שירות למילוי על ידי מנהל אזור
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-right">{serviceName}</p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Triangle Photo */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              צילום משולש אזהרה מוצב במקום
              <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>
            </label>
            <input type="file" accept="image/*" capture="environment" className="hidden" id="proof-triangle-input"
              onChange={(e) => { if (e.target.files?.[0]) setTrianglePhoto(e.target.files[0]); }}
            />
            <Button variant="outline"
              className={cn("w-full h-14 rounded-xl text-base", trianglePhoto && "border-emerald-400 text-emerald-700")}
              onClick={() => document.getElementById("proof-triangle-input")?.click()}
            >
              {trianglePhoto ? (<><CheckCircle2 className="h-5 w-5 ml-2 text-emerald-500" />צולם בהצלחה</>) : (<><Camera className="h-5 w-5 ml-2" />צלם משולש אזהרה</>)}
            </Button>
            {trianglePhoto && (
              <div className="flex gap-2 mt-2">
                <div className="relative shrink-0">
                  <img src={URL.createObjectURL(trianglePhoto)} className="h-16 w-16 object-cover rounded-lg" />
                  <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs" onClick={() => setTrianglePhoto(null)}><X className="h-3 w-3" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Barcode Photo */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              צילום ברקוד תלוי
              <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>
            </label>
            <input type="file" accept="image/*" capture="environment" className="hidden" id="proof-barcode-input"
              onChange={(e) => { if (e.target.files?.[0]) setBarcodePhoto(e.target.files[0]); }}
            />
            <Button variant="outline"
              className={cn("w-full h-14 rounded-xl text-base", barcodePhoto && "border-emerald-400 text-emerald-700")}
              onClick={() => document.getElementById("proof-barcode-input")?.click()}
            >
              {barcodePhoto ? (<><CheckCircle2 className="h-5 w-5 ml-2 text-emerald-500" />צולם בהצלחה</>) : (<><Camera className="h-5 w-5 ml-2" />צלם ברקוד תלוי</>)}
            </Button>
            {barcodePhoto && (
              <div className="flex gap-2 mt-2">
                <div className="relative shrink-0">
                  <img src={URL.createObjectURL(barcodePhoto)} className="h-16 w-16 object-cover rounded-lg" />
                  <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs" onClick={() => setBarcodePhoto(null)}><X className="h-3 w-3" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Work Start Date */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              תאריך תחילת עבודה
              <Badge variant="destructive" className="text-[10px] mr-1">חובה</Badge>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-14 rounded-xl text-base justify-start", !workStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-5 w-5 ml-2" />
                  {workStartDate ? format(workStartDate, "dd/MM/yyyy", { locale: he }) : "בחר תאריך תחילת עבודה"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={workStartDate} onSelect={setWorkStartDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Optional Photos */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <Camera className="h-4 w-4" />
              תמונות נוספות
              <Badge variant="secondary" className="text-[10px] mr-1">אופציונלי</Badge>
            </label>
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" id="proof-extra-photos"
              onChange={(e) => { if (e.target.files) setExtraPhotos((prev) => [...prev, ...Array.from(e.target.files!)]); }}
            />
            <Button variant="outline" className="w-full h-14 rounded-xl text-base"
              onClick={() => document.getElementById("proof-extra-photos")?.click()}
            >
              <Camera className="h-5 w-5 ml-2" />
              צלם תמונה ({extraPhotos.length})
            </Button>
            {extraPhotos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {extraPhotos.map((p, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={URL.createObjectURL(p)} className="h-16 w-16 object-cover rounded-lg" />
                    <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                      onClick={() => setExtraPhotos((prev) => prev.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Videos */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <Video className="h-4 w-4" />
              סרטונים
              <Badge variant="secondary" className="text-[10px] mr-1">אופציונלי</Badge>
            </label>
            <input type="file" accept="video/*" capture="environment" className="hidden" id="proof-extra-videos"
              onChange={(e) => { if (e.target.files) setExtraVideos((prev) => [...prev, ...Array.from(e.target.files!)]); }}
            />
            <Button variant="outline" className="w-full h-14 rounded-xl text-base"
              onClick={() => document.getElementById("proof-extra-videos")?.click()}
            >
              <Video className="h-5 w-5 ml-2" />
              צלם סרטון ({extraVideos.length})
            </Button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              הערות
            </label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות..." className="rounded-xl min-h-[80px]" />
          </div>

          {/* Submit */}
          <Button className="w-full h-14 text-base font-bold rounded-xl" disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin ml-2" /> : <CheckCircle2 className="h-5 w-5 ml-2" />}
            {submitting ? "שולח..." : "שלח טופס"}
          </Button>

          {!canSubmit && (
            <p className="text-xs text-destructive text-center">
              {!trianglePhoto && "⚠️ נדרש צילום משולש אזהרה · "}
              {!barcodePhoto && "⚠️ נדרש צילום ברקוד תלוי · "}
              {!workStartDate && "⚠️ נדרש תאריך תחילת עבודה"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
