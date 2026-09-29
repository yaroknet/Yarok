import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Camera } from "lucide-react";
import { toast } from "sonner";

export default function KmMonthlyReportForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const anon = SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fleet-km-public?token=${token}`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "טעינה נכשלה");
      setData(j);
      if (j.fleet_drivers?.full_name) setName(j.fleet_drivers.full_name);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [token]);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const path = `km-reports/${token}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("fleet-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("fleet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      setPhotoUrl(signed?.signedUrl ?? path);
      toast.success("התמונה הועלתה");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!km || Number(km) <= 0) { toast.error("יש להזין ק\"מ תקין"); return; }
    if (!photoUrl) { toast.error("חובה לצלם את מד הק\"מ"); return; }
    setSaving(true);
    try {
      const anon = SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fleet-km-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ token, current_km: Number(km), odometer_image: photoUrl, note, submitted_by_name: name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "שמירה נכשלה");
      toast.success("הדיווח נשלח בהצלחה");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (err) return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6"><Card className="p-6 max-w-md text-center"><h1 className="text-lg font-semibold mb-2">קישור לא תקין</h1><p className="text-sm text-muted-foreground">{err}</p></Card></div>;

  const v = data.fleet_vehicles, d = data.fleet_drivers;
  const done = data.status === "submitted";

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card className="p-5 text-center bg-primary text-primary-foreground">
          <div className="text-2xl">🚗</div>
          <h1 className="text-lg font-bold mt-1">דיווח ק"מ חודשי</h1>
          <div className="text-sm opacity-90 mt-1">{d?.full_name}</div>
          <div className="text-xs opacity-80">{[v.make, v.model].filter(Boolean).join(" ")} · {v.license_plate}</div>
          <div className="text-xs opacity-80">חודש {String(data.month).padStart(2, "0")}/{data.year}</div>
        </Card>

        {done ? (
          <Card className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div className="font-semibold">הדיווח התקבל בהצלחה</div>
            <div className="text-sm text-muted-foreground">ק"מ שדווח: {data.current_km?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{new Date(data.submitted_at).toLocaleString("he-IL")}</div>
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div>
              <Label className="text-xs">שם מדווח</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="שמך" />
            </div>
            <div>
              <Label className="text-xs">ק"מ נוכחי במד *</Label>
              <Input type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} placeholder="לדוגמה 82500" className="text-2xl h-14 text-center font-mono" />
              {v.current_km ? <div className="text-xs text-muted-foreground mt-1">ק"מ אחרון במערכת: {v.current_km.toLocaleString()}</div> : null}
            </div>
            <div>
              <Label className="text-xs">צילום מד הק"מ *</Label>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50">
                {photoUrl ? (
                  <img src={photoUrl} alt="מד ק״מ" className="max-h-40 rounded" />
                ) : uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  <><Camera className="h-8 w-8 text-muted-foreground" /><span className="text-sm">לחץ לצילום / העלאה</span></>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
              </label>
            </div>
            <div>
              <Label className="text-xs">הערה</Label>
              <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="לא חובה" />
            </div>
            <Button className="w-full h-12 text-base" onClick={submit} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              שליחת דיווח
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
