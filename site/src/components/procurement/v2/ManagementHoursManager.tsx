import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const ManagementHoursManager = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ month: new Date().toISOString().slice(0, 7) });

  const load = async () => {
    const [{ data: h }, { data: u }, { data: c }] = await Promise.all([
      supabase.from('management_hours').select('*, profiles!management_hours_user_id_fkey(full_name), clients(name)').order('month', { ascending: false }),
      supabase.from('profiles').select('user_id,full_name').order('full_name'),
      supabase.from('clients').select('id,name').order('name'),
    ]);
    setRows(h || []); setUsers(u || []); setClients(c || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft.user_id || !draft.client_id || !draft.month || !draft.hours) { toast.error('מלא הכל'); return; }
    const monthDate = draft.month.length === 7 ? draft.month + '-01' : draft.month;
    const { error } = await supabase.from('management_hours').upsert({
      user_id: draft.user_id, client_id: draft.client_id, month: monthDate, hours: parseFloat(draft.hours), notes: draft.notes || null,
    }, { onConflict: 'user_id,client_id,month' });
    if (error) { toast.error('שגיאה'); return; }
    toast.success('נשמר'); setDraft({ month: draft.month }); load();
  };

  const del = async (id: string) => { await supabase.from('management_hours').delete().eq('id', id); load(); };

  return (
    <Card>
      <CardHeader><CardTitle>שעות ניהול</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border rounded-lg p-3 bg-muted/30">
          <div>
            <Label className="text-xs">עובד</Label>
            <Select value={draft.user_id || ''} onValueChange={v => setDraft({ ...draft, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">לקוח</Label>
            <Select value={draft.client_id || ''} onValueChange={v => setDraft({ ...draft, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">חודש</Label><Input type="month" value={draft.month || ''} onChange={e => setDraft({ ...draft, month: e.target.value })} /></div>
          <div><Label className="text-xs">שעות</Label><Input type="number" step="0.25" value={draft.hours || ''} onChange={e => setDraft({ ...draft, hours: e.target.value })} /></div>
          <Button onClick={save}><Plus className="h-4 w-4 ml-1" /> שמור</Button>
        </div>

        <div className="space-y-1">
          {rows.map(r => (
            <div key={r.id} className="border rounded p-2 flex items-center justify-between text-sm">
              <div>{r.profiles?.full_name} • {r.clients?.name} • {r.month?.slice(0,7)} • <b>{r.hours} שעות</b></div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">אין רישומים</p>}
        </div>
      </CardContent>
    </Card>
  );
};
