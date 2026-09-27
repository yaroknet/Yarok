import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Star, List } from 'lucide-react';
import { toast } from 'sonner';
import { SupplierPriceListEditor } from './SupplierPriceListEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface Contact { name: string; phone: string; email: string; is_default: boolean; }

export const SuppliersManager = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [priceListSupplier, setPriceListSupplier] = useState<any>(null);

  const load = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const openEditor = (r: any = null) => {
    setEditing(r
      ? { ...r, contacts: (r.contacts && r.contacts.length ? r.contacts : [{ name: '', phone: '', email: '', is_default: true }]) as Contact[] }
      : { active: true, contacts: [{ name: '', phone: '', email: '', is_default: true }] as Contact[] }
    );
    setOpen(true);
  };

  const save = async () => {
    if (!editing?.name) { toast.error('שם חובה'); return; }
    const contacts = (editing.contacts as Contact[]).filter(c => c.name || c.phone || c.email);
    if (contacts.length && !contacts.some(c => c.is_default)) contacts[0].is_default = true;
    const primary = contacts.find(c => c.is_default) || contacts[0];
    const payload: any = {
      name: editing.name,
      contacts,
      contact_name: primary?.name || null,
      phone: primary?.phone || null,
      email: primary?.email || null,
      address: editing.address || null,
      notes: editing.notes || null,
      active: editing.active ?? true,
    };
    if (editing.id) await supabase.from('suppliers').update(payload).eq('id', editing.id);
    else await supabase.from('suppliers').insert(payload);
    toast.success('נשמר'); setOpen(false); setEditing(null); load();
  };

  const del = async (id: string) => { if (!confirm('למחוק ספק?')) return; await supabase.from('suppliers').delete().eq('id', id); load(); };

  const updateContact = (i: number, patch: Partial<Contact>) => {
    const list: Contact[] = [...editing.contacts];
    list[i] = { ...list[i], ...patch };
    if (patch.is_default) list.forEach((c, idx) => { if (idx !== i) c.is_default = false; });
    setEditing({ ...editing, contacts: list });
  };
  const addContact = () => setEditing({ ...editing, contacts: [...editing.contacts, { name: '', phone: '', email: '', is_default: false }] });
  const removeContact = (i: number) => setEditing({ ...editing, contacts: editing.contacts.filter((_: any, idx: number) => idx !== i) });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ספקים</CardTitle>
        <Button size="sm" onClick={() => openEditor()}><Plus className="h-4 w-4 ml-1" /> ספק חדש</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => {
          const contacts: Contact[] = r.contacts || [];
          return (
            <div key={r.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">{r.name} {!r.active && <Badge variant="outline">לא פעיל</Badge>}</div>
                  {contacts.length > 0 ? (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {contacts.map((c, i) => (
                        <div key={i}>
                          {c.is_default && <Star className="inline h-3 w-3 text-primary ml-1" />}
                          {c.name} • {c.phone} • {c.email}
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-muted-foreground">ללא אנשי קשר</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPriceListSupplier(r)}><List className="h-4 w-4 ml-1" /> מחירון</Button>
                  <Button size="icon" variant="ghost" onClick={() => openEditor(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">אין ספקים</p>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>שם *</Label><Input value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>כתובת</Label><Input value={editing?.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><Label>הערות</Label><Textarea value={editing?.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">אנשי קשר</Label>
                <Button size="sm" variant="outline" onClick={addContact}><Plus className="h-4 w-4 ml-1" /> הוסף</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">איש הקשר המסומן כברירת מחדל יופיע כברירת מחדל בשליחת ההזמנות.</p>
              <div className="space-y-2">
                {(editing?.contacts || []).map((c: Contact, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                    <div className="col-span-3"><Label className="text-xs">שם</Label><Input value={c.name} onChange={e => updateContact(i, { name: e.target.value })} /></div>
                    <div className="col-span-3"><Label className="text-xs">טלפון</Label><Input value={c.phone} onChange={e => updateContact(i, { phone: e.target.value })} /></div>
                    <div className="col-span-4"><Label className="text-xs">אימייל</Label><Input value={c.email} onChange={e => updateContact(i, { email: e.target.value })} /></div>
                    <div className="col-span-1 flex items-center gap-1 pb-2">
                      <Checkbox checked={c.is_default} onCheckedChange={v => updateContact(i, { is_default: !!v })} />
                      <span className="text-[10px]">ברירת מחדל</span>
                    </div>
                    <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => removeContact(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox checked={editing?.active ?? true} onCheckedChange={v => setEditing({ ...editing, active: !!v })} />
              <Label>פעיל</Label>
            </div>
            <Button onClick={save} className="w-full">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>

      {priceListSupplier && (
        <Dialog open onOpenChange={(v) => !v && setPriceListSupplier(null)}>
          <DialogContent dir="rtl" className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>מחירון – {priceListSupplier.name}</DialogTitle></DialogHeader>
            <SupplierPriceListEditor supplierId={priceListSupplier.id} />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
