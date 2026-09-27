import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, Plus, Send, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BILLING_ENTITY = 'ירוק שירותי אחזקה ניקיון וכח אדם בע"מ 514854116';

interface Line { internal_item_id: string; quantity: number; user_note: string; }
interface Props { onCreated?: () => void; }

export const NewOrderWizard = ({ onCreated }: Props) => {
  const { user, isSuperAdmin } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [allowedMap, setAllowedMap] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [requesterId, setRequesterId] = useState<string>('');
  const [requesterOpen, setRequesterOpen] = useState(false);
  const [addressId, setAddressId] = useState<string>('');
  const [addressOpen, setAddressOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [addressText, setAddressText] = useState('');
  const emptyLines = (): Line[] => Array.from({ length: 6 }, () => ({ internal_item_id: '', quantity: 1, user_note: '' }));
  const [lines, setLines] = useState<Line[]>(emptyLines());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, cat, allowed, mgrs] = await Promise.all([
        supabase.from('shipping_addresses').select('*, clients(name)').eq('active', true).order('site_name'),
        supabase.from('internal_catalog_items').select('*').eq('active', true).order('name').then(res => {
          if (!isSuperAdmin && res.data) return { ...res, data: res.data.filter((x: any) => (x.permission || 'region_manager') === 'region_manager') };
          return res;
        }),
        supabase.from('site_allowed_items' as any).select('*'),
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
      ]);
      setAddresses(a.data || []);
      setCatalog(cat.data || []);
      setAllowedMap((allowed.data as any[]) || []);
      setManagers((mgrs.data as any[]) || []);
    })();
  }, []);


  const selectedAddress = addresses.find(a => a.id === addressId);

  // Filter catalog by site allowed items. If no rules exist for site, show everything.
  const availableCatalog = useMemo(() => {
    if (!addressId) return catalog;
    const rules = allowedMap.filter(r => r.shipping_address_id === addressId);
    if (rules.length === 0) return catalog;
    const blocked = new Set(rules.filter(r => r.is_blocked).map(r => r.internal_item_id));
    const allowed = new Set(rules.filter(r => !r.is_blocked).map(r => r.internal_item_id));
    return catalog.filter(c => !blocked.has(c.id) && allowed.has(c.id));
  }, [addressId, catalog, allowedMap]);

  const pickAddress = (id: string) => {
    setAddressId(id);
    setAddressOpen(false);
    const a = addresses.find(x => x.id === id);
    if (a) {
      setContactName(a.contact_name || '');
      setContactPhone(a.contact_phone || '');
      setAddressText(a.address || '');
      setShippingNotes(a.notes || '');
    }
  };

  const addLine = () => setLines([...lines, { internal_item_id: '', quantity: 1, user_note: '' }]);
  const updateLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const submit = async (asDraft: boolean) => {
    if (!user) return;
    if (!requesterId) { toast.error('בחר מנהל מבקש'); return; }
    if (!addressId) { toast.error('בחר כתובת שילוח'); return; }
    // Only rows with an actual product selected are persisted; empty rows are ignored silently.
    const nonEmpty = lines.filter(l => l.internal_item_id);
    if (nonEmpty.length === 0) { toast.error('בחר לפחות מוצר אחד'); return; }
    setLoading(true);
    const { data: order, error } = await supabase.from('procurement_orders').insert({
      created_by: user.id,
      requested_by: requesterId,
      client_id: selectedAddress?.client_id || null,
      shipping_address_id: addressId,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      shipping_notes: shippingNotes || null,
      billing_entity: BILLING_ENTITY,
      status: asDraft ? 'draft' : 'pending_approval',
      submitted_at: asDraft ? null : new Date().toISOString(),
    } as any).select().single();
    if (error || !order) {
      console.error('create order failed', error);
      toast.error(`שגיאה ביצירת הזמנה: ${error?.message || ''}`);
      setLoading(false);
      return;
    }

    const linesPayload = nonEmpty.map((l, idx) => ({
      order_id: order.id, internal_item_id: l.internal_item_id, quantity: l.quantity,
      user_note: l.user_note || null, sort_order: idx,
    }));
    await supabase.from('procurement_order_lines').insert(linesPayload);
    await supabase.from('procurement_order_activity').insert({
      order_id: order.id, actor_id: user.id,
      action: asDraft ? 'created_draft' : 'submitted',
      to_status: asDraft ? 'draft' : 'pending_approval',
    });
    toast.success(asDraft ? 'נשמר כטיוטה' : 'ההזמנה נשלחה לאישור');
    setLines(emptyLines()); setAddressId(''); setContactName(''); setContactPhone(''); setShippingNotes(''); setAddressText(''); setRequesterId('');
    setLoading(false);
    onCreated?.();
  };

  return (
    <Card>
      <CardHeader><CardTitle>הזמנה חדשה</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">הלקוח המזמין: </span>
          <b>{BILLING_ENTITY}</b>
        </div>

        <div>
          <Label>מנהל אזור מבקש *</Label>
          <Popover open={requesterOpen} onOpenChange={setRequesterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                {requesterId ? (managers.find(m => m.user_id === requesterId)?.full_name || 'בחר...') : 'התחל להקליד שם מנהל...'}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command
                filter={(value, search) => {
                  const m = managers.find(x => x.user_id === value);
                  if (!m) return 0;
                  return (m.full_name || '').toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                }}
              >
                <CommandInput placeholder="הקלד לחיפוש..." />
                <CommandList>
                  <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                  <CommandGroup>
                    {managers.map(m => (
                      <CommandItem key={m.user_id} value={m.user_id} onSelect={() => { setRequesterId(m.user_id); setRequesterOpen(false); }}>
                        <Check className={cn('ml-2 h-4 w-4', requesterId === m.user_id ? 'opacity-100' : 'opacity-0')} />
                        <span>{m.full_name || m.user_id}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>


        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>כתובת שילוח (אתר לקוח) *</Label>
            <Popover open={addressOpen} onOpenChange={setAddressOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedAddress
                    ? `${selectedAddress.site_name} — ${selectedAddress.clients?.name || ''} — ${selectedAddress.address}`
                    : 'חפש אתר / לקוח / כתובת...'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command
                  filter={(value, search) => {
                    const a = addresses.find(x => x.id === value);
                    if (!a) return 0;
                    const hay = `${a.site_name} ${a.clients?.name || ''} ${a.address} ${a.contact_name || ''}`.toLowerCase();
                    return hay.includes(search.toLowerCase()) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="הקלד לחיפוש..." />
                  <CommandList>
                    <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                    <CommandGroup>
                      {addresses.map(a => (
                        <CommandItem key={a.id} value={a.id} onSelect={() => pickAddress(a.id)}>
                          <Check className={cn('ml-2 h-4 w-4', addressId === a.id ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex-1">
                            <div className="font-medium">{a.site_name} {a.clients?.name ? <span className="text-muted-foreground text-xs">— {a.clients.name}</span> : null}</div>
                            <div className="text-xs text-muted-foreground">{a.address}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="md:col-span-2"><Label>כתובת</Label><Input value={addressText} onChange={e => setAddressText(e.target.value)} placeholder="מתמלא אוטומטית" /></div>
          <div><Label>איש קשר</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} /></div>
          <div><Label>טלפון</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
        </div>
        <div>
          <Label>הערות שילוח</Label>
          <Textarea value={shippingNotes} onChange={e => setShippingNotes(e.target.value)} rows={2} />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium">מוצרים</h3>
              {addressId && (
                <p className="text-xs text-muted-foreground">מוצגים מוצרים המותרים לאתר זה ({availableCatalog.length})</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 ml-1" /> הוסף מוצר</Button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <ProductLineRow
                key={i}
                line={l}
                catalog={availableCatalog}
                onUpdate={(patch) => updateLine(i, patch)}
                onRemove={() => removeLine(i)}
              />
            ))}
            {lines.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">לחץ "הוסף מוצר" כדי להוסיף שורה נוספת</p>}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => submit(true)} disabled={loading}>שמור כטיוטה</Button>
          <Button onClick={() => submit(false)} disabled={loading}><Send className="h-4 w-4 ml-1" /> שלח לאישור</Button>
        </div>
      </CardContent>
    </Card>
  );
};

function ProductLineRow({
  line, catalog, onUpdate, onRemove,
}: {
  line: Line;
  catalog: any[];
  onUpdate: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const item = catalog.find(c => c.id === line.internal_item_id);
  return (
    <div dir="rtl" className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2 text-right">
      <div className="col-span-5">
        <Label className="text-xs block text-right">מוצר</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              <span className="truncate text-right">{item ? `${item.name} (${item.unit_of_measure})` : 'הקלד לחיפוש מוצר...'}</span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <Command
              filter={(value, search) => {
                const c = catalog.find(x => x.id === value);
                if (!c) return 0;
                const hay = `${c.name} ${c.category || ''} ${c.unit_of_measure || ''}`.toLowerCase();
                return hay.includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="הקלד שם מוצר..." />
              <CommandList className="max-h-72">
                <CommandEmpty>לא נמצאו מוצרים</CommandEmpty>
                <CommandGroup>
                  {catalog.map(c => (
                    <CommandItem key={c.id} value={c.id} onSelect={() => { onUpdate({ internal_item_id: c.id }); setOpen(false); }}>
                      <Check className={cn('ml-2 h-4 w-4', line.internal_item_id === c.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex-1 text-right">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.unit_of_measure}{c.category ? ` • ${c.category}` : ''}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="col-span-2"><Label className="text-xs block text-right">כמות</Label><Input type="number" min={1} value={line.quantity} onChange={e => onUpdate({ quantity: parseFloat(e.target.value) || 1 })} className="text-center" /></div>
      <div className="col-span-4"><Label className="text-xs block text-right">הערה</Label><Input value={line.user_note} onChange={e => onUpdate({ user_note: e.target.value })} className="text-right" /></div>
      <div className="col-span-1 flex justify-center"><Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
    </div>
  );
}
