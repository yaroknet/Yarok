import { useState, useEffect, useRef } from "react";
import { Building, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ClientLogo {
  id: string;
  slot_number: number;
  file_url: string;
  file_name: string | null;
  alt_text: string | null;
}

const ClientLogosGrid = () => {
  const { user, isSuperAdmin, isManager } = useAuth();
  const [logos, setLogos] = useState<ClientLogo[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const canManage = isSuperAdmin || isManager;
  const slots = Array.from({ length: 12 }, (_, i) => i + 1);

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    try {
      const { data, error } = await supabase
        .from("client_logos")
        .select("*")
        .order("slot_number");

      if (error) throw error;
      setLogos(data || []);
    } catch (error) {
      console.error("Error fetching logos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLogoForSlot = (slotNumber: number) => {
    return logos.find((logo) => logo.slot_number === slotNumber);
  };

  const handleUpload = async (slotNumber: number, file: File) => {
    if (!canManage) {
      toast.error("אין לך הרשאה להעלות לוגואים");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("ניתן להעלות תמונות בלבד");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("גודל הקובץ המקסימלי הוא 2MB");
      return;
    }

    setUploading(slotNumber);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `slot-${slotNumber}-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("client-logos")
        .getPublicUrl(fileName);

      const existingLogo = getLogoForSlot(slotNumber);

      if (existingLogo) {
        // Delete old file from storage
        const oldFileName = existingLogo.file_url.split("/").pop();
        if (oldFileName) {
          await supabase.storage.from("client-logos").remove([oldFileName]);
        }

        // Update existing record
        const { error: updateError } = await supabase
          .from("client_logos")
          .update({
            file_url: urlData.publicUrl,
            file_name: file.name,
            updated_at: new Date().toISOString(),
          })
          .eq("slot_number", slotNumber);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("client_logos")
          .insert({
            slot_number: slotNumber,
            file_url: urlData.publicUrl,
            file_name: file.name,
          });

        if (insertError) throw insertError;
      }

      toast.success("הלוגו הועלה בהצלחה");
      fetchLogos();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "שגיאה בהעלאת הלוגו");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (slotNumber: number) => {
    if (!canManage) return;

    const logo = getLogoForSlot(slotNumber);
    if (!logo) return;

    try {
      // Delete from storage
      const fileName = logo.file_url.split("/").pop();
      if (fileName) {
        await supabase.storage.from("client-logos").remove([fileName]);
      }

      // Delete from database
      const { error } = await supabase
        .from("client_logos")
        .delete()
        .eq("slot_number", slotNumber);

      if (error) throw error;

      toast.success("הלוגו נמחק בהצלחה");
      fetchLogos();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("שגיאה במחיקת הלוגו");
    }
  };

  const triggerFileInput = (slotNumber: number) => {
    if (!canManage) return;
    fileInputRefs.current[slotNumber - 1]?.click();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-5xl mx-auto">
        {slots.map((slot) => (
          <div
            key={slot}
            className="aspect-[3/2] bg-background rounded-lg border-2 border-dashed border-border flex items-center justify-center"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-5xl mx-auto">
      {slots.map((slotNumber) => {
        const logo = getLogoForSlot(slotNumber);
        const isUploading = uploading === slotNumber;

        return (
          <div
            key={slotNumber}
            className={`relative aspect-[3/2] bg-background rounded-lg border-2 ${
              logo ? "border-border" : "border-dashed border-border"
            } ${canManage ? "hover:border-primary/50 cursor-pointer" : ""} flex items-center justify-center transition-colors group overflow-hidden`}
            onClick={() => !logo && triggerFileInput(slotNumber)}
          >
            <input
              ref={(el) => (fileInputRefs.current[slotNumber - 1] = el)}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(slotNumber, file);
                e.target.value = "";
              }}
            />

            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : logo ? (
              <>
                <img
                  src={logo.file_url}
                  alt={logo.alt_text || `לוגו לקוח ${slotNumber}`}
                  className="w-full h-full object-contain p-2"
                />
                {canManage && (
                  <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerFileInput(slotNumber);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(slotNumber);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-4">
                {canManage ? (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1 group-hover:text-primary/60 transition-colors" />
                    <span className="text-xs text-muted-foreground/50 group-hover:text-primary/60">
                      לחץ להעלאה
                    </span>
                  </>
                ) : (
                  <>
                    <Building className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                    <span className="text-xs text-muted-foreground/50">
                      לוגו {slotNumber}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClientLogosGrid;
