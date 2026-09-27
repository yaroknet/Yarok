import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { qualityLabel } from '@/lib/procurement/recommendations';
import { toast } from 'sonner';
import { Search, Link as LinkIcon, Loader2 } from 'lucide-react';

interface Props {
  internalItemId: string;
  internalItemName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

type Row = {
  id: string;
  supplier_id: string;
  supplier_sku: string | null;
  supplier_product_name: string;
  unit_price: number;
  pack_size: number | null;
  quality: 'basic' | 'standard' | 'premium';
  notes: string | null;
  active: boolean;
  internal_item_id: string | null;
  suppliers?: { name: string } | null;
};

export const LinkSupplierItemsDialog = ({ internalItemId, internalItemName, open, onOpenChange, onSaved }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [onlyLinked, setOnlyLinked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('supplier_catalog_items')
      .select('id, supplier_id, supplier_sku, supplier_product_name, unit_price, pack_size, quality, notes, active, internal_item_id, suppliers(name)')
      .order('supplier_product_name');
    const list = (data as any[] as Row[]) || [];
    setRows(list);
    setSelected(new Set(list.filter(r => r.internal_item_id === internalItemId).map(r => r.id)));
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open, internalItemId]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.supplier_id) map.set(r.supplier_id, r.suppliers?.name || ''); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter(r => {
      if (supplierFilter !== 'all' && r.supplier_id !== supplierFilter) return false;
      if (qualityFilter !== 'all' && r.quality !== qualityFilter) return false;
      if (onlyLinked && !selected.has(r.id)) return false;
      if (qq) {
        const hay = `${r.supplier_product_name || ''} ${r.supplier_sku || ''} ${r.suppliers?.name || ''}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, supplierFilter, qualityFilter, onlyLinked, selected]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const currentlyLinkedIds = rows.filter(r => r.internal_item_id === internalItemId).map(r => r.id);
      const toLink = [...selected].filter(id => !currentlyLinkedIds.includes(id));
      const toUnlink = currentlyLinkedIds.filter(id => !selected.has(id));

      // Warn if linking items already linked to another internal item
      const conflicts = rows.filter(r => toLink.includes(r.id) && r.internal_item_id && r.internal_item_id !== internalItemId);
      if (conflicts.length) {
        const ok = window.confirm(`${conflicts.length} מוצרי ספק כבר מקושרים למוצר פנימי אחר.\nלהעביר את השיוך למוצר זה?`);
        if (!ok) { setSaving(false); return; }
      }

      if (toLink.length) {
        const { error } = await supabase.from('supplier_catalog_items').update({ internal_item_id: internalItemId }).in('id', toLink);
        if (error) throw error;
      }
      if (toUnlink.length) {
        const { error } = await supabase.from('supplier_catalog_items').update({ internal_item_id: null }).in('id', toUnlink);
        if (error) throw error;
      }
      toast.success(`נשמר: ${selected.size} מוצרי ספק מקושרים`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('שגיאה בשמירה: ' + (e.message || ''));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> שיוך מוצרי ספק — {internalItemName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-4 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pr-10" placeholder="חיפוש לפי שם מוצר / מק״ט / ספק" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger><SelectValue placeholder="ספק" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הספקים</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={qualityFilter} onValueChange={setQualityFilter}>
            <SelectTrigger><SelectValue placeholder="איכות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל האיכויות</SelectItem>
              <SelectItem value="basic">בסיסי</SelectItem>
              <SelectItem value="standard">סטנדרט</SelectItem>
              <SelectItem value="premium">איכותי</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyLinked} onCheckedChange={v => setOnlyLinked(!!v)} />
            הצג רק מקושרים
          </label>
          <span className="text-muted-foreground">נבחרו: <b>{selected.size}</b> • מוצג {filtered.length} מתוך {rows.length}</span>
        </div>

        <div className="border rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2 text-right">ספק</th>
                  <th className="p-2 text-right">מק"ט</th>
                  <th className="p-2 text-right">שם מוצר ספק</th>
                  <th className="p-2 text-right">מחיר ליח׳ (לפני מע"מ)</th>
                  <th className="p-2 text-right">יח׳ במארז</th>
                  <th className="p-2 text-right">איכות</th>
                  <th className="p-2 text-right">הערות</th>
                  <th className="p-2 text-right">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const linkedElsewhere = r.internal_item_id && r.internal_item_id !== internalItemId && !selected.has(r.id);
                  return (
                    <tr key={r.id} className={`border-t ${selected.has(r.id) ? 'bg-primary/5' : ''}`}>
                      <td className="p-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                      <td className="p-2">{r.suppliers?.name || '-'}</td>
                      <td className="p-2 font-mono text-xs">{r.supplier_sku || '-'}</td>
                      <td className="p-2">{r.supplier_product_name}</td>
                      <td className="p-2">₪{Number(r.unit_price).toFixed(2)}</td>
                      <td className="p-2">{r.pack_size || 1}</td>
                      <td className="p-2">{qualityLabel[r.quality] || r.quality}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r.notes || '-'}</td>
                      <td className="p-2 text-xs">
                        {r.active === false && <Badge variant="outline">לא פעיל</Badge>}
                        {linkedElsewhere && <Badge variant="secondary" className="mr-1">מקושר למוצר אחר</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground p-6">אין תוצאות</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} שמור שיוך ({selected.size})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
