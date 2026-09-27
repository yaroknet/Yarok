import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export function FileUpload({ folder, value, onChange, accept }: { folder: string; value?: string | null; onChange: (url: string | null) => void; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const up = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("fleet-files").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setBusy(false); e.target.value = ""; return; }
    const { data } = await supabase.storage.from("fleet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    onChange(data?.signedUrl ?? path);
    setBusy(false); e.target.value = "";
  };
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <>
          <a className="text-primary underline text-sm truncate max-w-xs" href={value} target="_blank" rel="noreferrer">קובץ קיים</a>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>
        </>
      ) : (
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="file" accept={accept} onChange={up} className="hidden" disabled={busy} />
          <span className="inline-flex items-center gap-2 px-3 py-1.5 border rounded hover:bg-accent">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}העלאה
          </span>
        </label>
      )}
    </div>
  );
}
