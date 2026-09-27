import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/employees/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { AlertTriangle, FileText, CalendarIcon, User, ClipboardList, Camera, Video } from "lucide-react";

interface ServiceStartProofViewerProps {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
}

export function ServiceStartProofViewer({
  open,
  onClose,
  serviceId,
  serviceName,
}: ServiceStartProofViewerProps) {
  const { data: proofs, isLoading } = useQuery({
    queryKey: ["service-start-proofs", serviceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_start_proofs")
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) return [];

      const enriched = await Promise.all(
        data.map(async (proof: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", proof.submitted_by)
            .single();

          const getSignedUrl = async (path: string) => {
            if (!path) return "";
            const { data } = await supabase.storage.from("field-media").createSignedUrl(path, 3600);
            return data?.signedUrl || "";
          };

          const triangleUrl = await getSignedUrl(proof.triangle_photo_url);
          const barcodeUrl = await getSignedUrl(proof.barcode_photo_url);

          const extraPhotoUrls = await Promise.all(
            (proof.extra_photos || []).map((p: string) => getSignedUrl(p))
          );
          const extraVideoUrls = await Promise.all(
            (proof.extra_videos || []).map((v: string) => getSignedUrl(v))
          );

          return {
            ...proof,
            submitterName: profile?.full_name || "לא ידוע",
            triangleSignedUrl: triangleUrl,
            barcodeSignedUrl: barcodeUrl,
            extraPhotoUrls,
            extraVideoUrls,
          };
        })
      );

      return enriched;
    },
    enabled: open && !!serviceId,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            טופס תחילת שירות
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-right">{serviceName}</p>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">טוען...</p>
        ) : !proofs || proofs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            טרם הוגש טופס תחילת שירות
          </p>
        ) : (
          <div className="space-y-6">
            {proofs.map((proof: any) => (
              <div key={proof.id} className="space-y-3 border rounded-xl p-4">
                <div className="bg-muted/50 rounded-lg p-2 text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">הוגש על ידי:</span> {proof.submitterName}
                </div>

                <div className="bg-muted/50 rounded-lg p-2 text-sm flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">תאריך תחילת עבודה:</span>{" "}
                  {format(parseISO(proof.work_start_date), "dd/MM/yyyy")}
                </div>

                <div className="bg-muted/50 rounded-lg p-2 text-sm">
                  <span className="font-bold">הוגש בתאריך:</span>{" "}
                  {format(parseISO(proof.created_at), "dd/MM/yyyy HH:mm")}
                </div>

                {/* Triangle Photo */}
                <div>
                  <p className="text-sm font-bold mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> משולש אזהרה
                  </p>
                  {proof.triangleSignedUrl ? (
                    <a href={proof.triangleSignedUrl} target="_blank" rel="noopener noreferrer">
                      <img src={proof.triangleSignedUrl} className="rounded-lg max-h-48 w-auto cursor-pointer hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">לא ניתן לטעון תמונה</p>
                  )}
                </div>

                {/* Barcode Photo */}
                <div>
                  <p className="text-sm font-bold mb-1 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> ברקוד תלוי
                  </p>
                  {proof.barcodeSignedUrl ? (
                    <a href={proof.barcodeSignedUrl} target="_blank" rel="noopener noreferrer">
                      <img src={proof.barcodeSignedUrl} className="rounded-lg max-h-48 w-auto cursor-pointer hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">לא ניתן לטעון תמונה</p>
                  )}
                </div>

                {/* Extra Photos */}
                {proof.extraPhotoUrls?.length > 0 && (
                  <div>
                    <p className="text-sm font-bold mb-1 flex items-center gap-1">
                      <Camera className="h-4 w-4" /> תמונות נוספות ({proof.extraPhotoUrls.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {proof.extraPhotoUrls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} className="rounded-lg object-cover aspect-square w-full cursor-pointer hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Videos */}
                {proof.extraVideoUrls?.length > 0 && (
                  <div>
                    <p className="text-sm font-bold mb-1 flex items-center gap-1">
                      <Video className="h-4 w-4" /> סרטונים ({proof.extraVideoUrls.length})
                    </p>
                    {proof.extraVideoUrls.map((url: string, i: number) => (
                      <video key={i} src={url} controls className="w-full rounded-lg mb-2" />
                    ))}
                  </div>
                )}

                {proof.notes && (
                  <div className="bg-muted/50 rounded-lg p-2 text-sm">
                    <span className="font-bold">הערות:</span> {proof.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
