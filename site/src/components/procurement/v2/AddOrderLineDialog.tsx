import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ChevronsUpDown, Plus } from 'lucide-react';

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
  currentUserId?: string | null;
  currentSortOrder: number;
}

type Internal = { id: string; name: string; unit_of_measure: string | null };
type SCI = {
  id: string; supplier_id: string; supplier_sku: string | null;
  supplier_product_name: string | null; pack_size: number; unit_price: number;
  internal_item_id: string | null; suppliers?: { id: string; name: string } | null;
};

export const AddOrderLineDialog = ({ orderId, open, onOpenChange, onAdded, currentUserId, currentSortOrder }: Props) => {
  const [internal, setInternal] = useState<Internal[]>([]);
  const [sci, setSci] = useState<SCI[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<Internal | null>(null);
  const [selectedSci, setSelectedSci] = useState<SCI | null>(null);
  const [openInternal, setOpenInternal] = useState(false);
  const [openSci, setOpenSci] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [packUnits, setPackUnits] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: ic }, { data: sc }] = await Promise.all([
        supabase.from('internal_catalog_items').select('id, name, unit_of_measure').eq('active', true).order('name'),
        supabase.from('supplier_catalog_items').select('id, supplier_id, supplier_sku, supplier_product_name, pack_size, unit_price, internal_item_id, suppliers(id,name)').eq('active', true),
      ]);
      setInternal((ic as any) || []);
      setSci((sc as any) || []);
      setSelectedInternal(null); setSelectedSci(null);
      setQuantity(1); setPackUnits(''); setPrice(''); setNote('');
    })();
  }, [open]);

  const filteredSci = useMemo(() => {
    if (!selectedInternal) return sci;
    const linked = sci.filter(s => s.internal_item_id === selectedInternal.id);
    return linked.length ? linked : sci;
  }, [sci, selectedInternal]);

  useEffect(() => {
    if (selectedSci) {
      setPackUnits(selectedSci.pack_size || '');
      setPrice(selectedSci.unit_price || '');
    }
  }, [selectedSci]);

  const save = async () => {
    if (!selectedInternal) { toast.error('בחר מוצר פנימי'); return; }
    if (!quantity || quantity <= 0) { toast.error('כמות לא תקינה'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: any = {
        order_id: orderId,
        internal_item_id: selectedInternal.id,
        supplier_catalog_item_id: selectedSci?.id || null,
        supplier_id: selectedSci?.supplier_id || null,
        supplier_sku: selectedSci?.supplier_sku || null,
        supplier_item_name: selectedSci?.supplier_product_name || null,
        pack_units: packUnits || null,
        quantity,
        unit_price_snapshot: price || null,
        line_total_snapshot: price ? Number(price) * quantity : null,
        admin_note: note || null,
        sort_order: currentSortOrder + 1,
        added_by_role: 'admin',
        added_by_user: currentUserId || null,
        last_edited_by: currentUserId || null,
        last_edited_at: now,
      };
      const { error } = await supabase.from('procurement_order_lines').insert(payload);
      if (error) throw error;
      await supabase.from('procurement_order_activity').insert({
        order_id: orderId, actor_id: currentUserId || null, action: 'line_added',
        details: { name: selectedInternal.name, quantity, supplier: selectedSci?.suppliers?.name || null } as any,
      });
      toast.success('המוצר נוסף להזמנה');
      onAdded(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהוספה');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>הוספת מוצר להזמנה</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>מוצר פנימי</Label>
            <Popover open={openInternal} onOpenChange={setOpenInternal}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{selectedInternal?.name || 'בחר מוצר פנימי'}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[560px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש לפי שם מוצר..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>אין תוצאות</CommandEmpty>
                    <CommandGroup>
                      {internal.slice(0, 300).map(i => (
                        <CommandItem key={i.id} value={i.name} onSelect={() => { setSelectedInternal(i); setSelectedSci(null); setOpenInternal(false); }}>
                          {i.name} <span className="text-xs text-muted-foreground mr-2">{i.unit_of_measure || ''}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>מוצר ספק (אופציונלי — ניתן להזין ידנית)</Label>
            <Popover open={openSci} onOpenChange={setOpenSci}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{selectedSci ? `${selectedSci.suppliers?.name} — ${selectedSci.supplier_product_name}` : 'בחר מוצר ספק / מק״ט'}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[560px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש לפי שם/מק״ט/ספק..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>אין תוצאות</CommandEmpty>
                    <CommandGroup>
                      {filteredSci.slice(0, 300).map(s => (
                        <CommandItem key={s.id} value={`${s.suppliers?.name} ${s.supplier_product_name} ${s.supplier_sku}`}
                          onSelect={() => { setSelectedSci(s); setOpenSci(false); }}>
                          <div className="flex-1">
                            <div className="text-xs font-medium">{s.suppliers?.name} — {s.supplier_product_name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.supplier_sku} • ₪{Number(s.unit_price).toFixed(2)} • מארז {s.pack_size}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>כמות</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} /></div>
            <div><Label>יח' במארז</Label><Input type="number" value={packUnits} onChange={e => setPackUnits(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
            <div><Label>מחיר יח' (₪)</Label><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
          </div>

          <div><Label>הערה</Label><Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} /></div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button onClick={save} disabled={saving}><Plus className="h-4 w-4 ml-1" /> הוסף להזמנה</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
