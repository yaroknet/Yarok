import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Package2 } from 'lucide-react';
import { toast } from 'sonner';
import { SiteAllowedItemsManager } from './SiteAllowedItemsManager';

export const ShippingAddressesManager = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [managingProducts, setManagingProducts] = useState<any>(null);

  const load = async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from('shipping_addresses').select('*, clients(name)').order('site_name'),
      supabase.from('clients').select('id,name').order('name'),
    ]);
    setRows(a || []); setClients(c || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.site_name || !editing?.address) { toast.error('שם אתר וכתובת חובה'); return; }
    const payload = { client_id: editing.client_id || null, site_name: editing.site_name, address: editing.address,
      contact_name: editing.contact_name || null, contact_phone: editing.contact_phone || null, notes: editing.notes || null, active: editing.active ?? true };
    if (editing.id) await supabase.from('shipping_addresses').update(payload).eq('id', editing.id);
    else await supabase.from('shipping_addresses').insert(payload);
    toast.success('נשמר'); setOpen(false); setEditing(null); load();
  };
  const del = async (id: string) => { if (!confirm('למחוק?')) return; await supabase.from('shipping_addresses').delete().eq('id', id); load(); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>לקוחות, כתובות ואנשי קשר</CardTitle>
        <Button size="sm" onClick={() => { setEditing({ active: true }); setOpen(true); }}><Plus className="h-4 w-4 ml-1" /> כתובת חדשה</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.site_name} <span className="text-xs text-muted-foreground">— {r.clients?.name || 'ללא לקוח'}</span></div>
              <div className="text-xs text-muted-foreground">{r.address} • {r.contact_name || ''} {r.contact_phone || ''}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setManagingProducts(r)}><Package2 className="h-4 w-4 ml-1" /> מוצרים באתר</Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">אין כתובות</p>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? 'עריכה' : 'כתובת שילוח חדשה'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>לקוח</Label>
              <Select value={editing?.client_id || ''} onValueChange={v => setEditing({ ...editing, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>שם אתר *</Label><Input value={editing?.site_name || ''} onChange={e => setEditing({ ...editing, site_name: e.target.value })} /></div>
            <div><Label>כתובת *</Label><Input value={editing?.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>איש קשר</Label><Input value={editing?.contact_name || ''} onChange={e => setEditing({ ...editing, contact_name: e.target.value })} /></div>
              <div><Label>טלפון</Label><Input value={editing?.contact_phone || ''} onChange={e => setEditing({ ...editing, contact_phone: e.target.value })} /></div>
            </div>
            <div><Label>הערות שילוח</Label><Textarea value={editing?.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            <Button onClick={save}>שמור</Button>
          </div>
        </DialogContent>
      </Dialog>

      {managingProducts && (
        <Dialog open onOpenChange={(v) => !v && setManagingProducts(null)}>
          <DialogContent dir="rtl" className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>מוצרים מותרים – {managingProducts.site_name}</DialogTitle></DialogHeader>
            <SiteAllowedItemsManager shippingAddressId={managingProducts.id} siteName={managingProducts.site_name} />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
