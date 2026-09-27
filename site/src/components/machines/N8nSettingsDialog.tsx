import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KEY = 'n8n_machines_webhook_url';

export default function N8nSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from('system_settings').select('setting_value').eq('setting_key', KEY).maybeSingle()
      .then(({ data }) => {
        const v: any = data?.setting_value;
        setUrl(typeof v === 'string' ? v : (v ?? ''));
        setLoading(false);
      });
  }, [open]);

  const save = async () => {
    setSaving(true);
    const clean = url.trim();
    const { data: exists } = await supabase.from('system_settings').select('id').eq('setting_key', KEY).maybeSingle();
    const payload: any = { setting_key: KEY, setting_value: clean as any, description: 'n8n webhook for machines add/status-change events' };
    const { error } = exists
      ? await supabase.from('system_settings').update(payload).eq('id', exists.id)
      : await supabase.from('system_settings').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('נשמר בהצלחה');
    onClose();
  };

  const testFire = async () => {
    if (!url.trim()) return toast.error('הזן כתובת Webhook');
    setTesting(true);
    try {
      const res = await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test_ping',
          machine_name: 'בדיקה — לא לפעולה',
          current_location: 'משרד',
          supplier_name: 'סנו',
          current_status: 'פעיל',
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) toast.success('נשלחה קריאת בדיקה ל-n8n');
      else toast.error(`נכשל: ${res.status}`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשליחה');
    } finally {
      setTesting(false);
    }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('הועתק'); };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>הגדרות אוטומציה — n8n Webhook למכונות</DialogTitle>
          <DialogDescription>
            שליחה אוטומטית ל-n8n בכל הוספת מכונה או שינוי סטטוס.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>N8N Webhook URL</Label>
              <Input
                dir="ltr"
                className="text-left mt-1"
                placeholder="https://your-instance.app.n8n.cloud/webhook/machines"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                מקבל POST עם JSON: <code dir="ltr">event, machine_name, current_location, supplier_name, current_status, previous_status</code>
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">איך מקליטים את ה-Webhook ב-n8n ושולחים מייל:</div>
                <ol className="list-decimal pr-5 space-y-1 text-sm">
                  <li>ב-n8n צור Workflow חדש והוסף Node מסוג <b>Webhook</b> (HTTP Method: POST).</li>
                  <li>העתק את ה-Test/Production URL ל-Node והדבק כאן למעלה.</li>
                  <li>הוסף Node של <b>Send Email</b> (או Gmail) אחרי ה-Webhook.</li>
                  <li>הגדר נמענים:
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => copy('office@yaroknet.co.il')}>
                        <Copy className="h-3 w-3 ml-1" /> office@yaroknet.co.il
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => copy('rotem@yaroknet.co.il')}>
                        <Copy className="h-3 w-3 ml-1" /> rotem@yaroknet.co.il
                      </Button>
                    </div>
                  </li>
                  <li>נושא לדוגמה: <code dir="ltr">{'{{$json.event}} — {{$json.machine_name}}'}</code></li>
                  <li>גוף לדוגמה: פרטי המכונה, סטטוס חדש/קודם, מיקום, ספק — מתוך <code dir="ltr">$json</code>.</li>
                  <li>הפעל את ה-Workflow (Activate) ולחץ "שלח בדיקה" למטה.</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>סגור</Button>
          <Button variant="secondary" onClick={testFire} disabled={testing || !url.trim()}>
            {testing && <Loader2 className="h-4 w-4 animate-spin ml-1" />} שלח בדיקה
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
