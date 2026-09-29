import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KEY = 'machines_notification_emails';

export default function MachinesNotificationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from('system_settings').select('setting_value').eq('setting_key', KEY).maybeSingle()
      .then(({ data }) => {
        const v: unknown = data?.setting_value;
        setEmails(Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
        setLoading(false);
      });
  }, [open]);

  const save = async () => {
    const list = emails.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
    const bad = list.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad.length) return toast.error(`כתובת מייל לא תקינה: ${bad.join(', ')}`);
    setSaving(true);
    const clean = list.join(', ');
    const { data: exists } = await supabase.from('system_settings').select('id').eq('setting_key', KEY).maybeSingle();
    const payload = { setting_key: KEY, setting_value: clean, description: 'נמעני מייל להוספת מכונה ושינוי סטטוס' };
    const { error } = exists
      ? await supabase.from('system_settings').update(payload).eq('id', exists.id)
      : await supabase.from('system_settings').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('נשמר בהצלחה');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>התראות מייל — מכונות</DialogTitle>
          <DialogDescription>
            בכל הוספת מכונה או שינוי סטטוס נשלח מייל מתיבת הדואר של החברה לנמענים שלהלן.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            <Label>נמענים</Label>
            <Input
              dir="ltr"
              className="text-left"
              placeholder="office@yaroknet.co.il, rotem@yaroknet.co.il"
              value={emails}
              onChange={e => setEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">אפשר כמה כתובות, מופרדות בפסיק. השארת השדה ריק מבטלת את ההתראות.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>סגור</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
