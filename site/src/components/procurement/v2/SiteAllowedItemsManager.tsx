import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  internal_item_id: string;
  itemName: string;
  category: string;
  existingId?: string;
  enabled: boolean;      // shown = row exists non-blocked
  is_blocked: boolean;
  is_default_for_category: boolean;
  fixture_type: string;
  notes: string;
  _dirty?: boolean;
}

export const SiteAllowedItemsManager = ({ shippingAddressId, siteName }: { shippingAddressId: string; siteName: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [original, setOriginal] = useState<Row[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: items }, { data: mapping }] = await Promise.all([
      supabase.from('internal_catalog_items').select('id,name,category').eq('active', true).order('name'),
      supabase.from('site_allowed_items' as any).select('*').eq('shipping_address_id', shippingAddressId),
    ]);
    const map = new Map(((mapping as any[]) || []).map((m: any) => [m.internal_item_id, m]));
    const noRulesYet = ((mapping as any[]) || []).length === 0;
    const list: Row[] = (items || []).map((it: any) => {
      const m = map.get(it.id);
      return {
        internal_item_id: it.id,
        itemName: it.name,
        category: it.category || '',
        existingId: m?.id,
        // If no rules exist yet, default all to enabled; otherwise only include ones that have a row and are not blocked
        enabled: noRulesYet ? true : (!!m && !m.is_blocked),
        is_blocked: !!m?.is_blocked,
        is_default_for_category: !!m?.is_default_for_category,
        fixture_type: m?.fixture_type || '',
        notes: m?.notes || '',
      };
    });
    setRows(list);
    setOriginal(JSON.parse(JSON.stringify(list)));
  };
  useEffect(() => { load(); }, [shippingAddressId]);

  const update = (id: string, patch: Partial<Row>) => setRows(rows.map(r => r.internal_item_id === id ? { ...r, ...patch, _dirty: true } : r));

  const cancel = () => { setRows(JSON.parse(JSON.stringify(original))); setEditMode(false); };

  const save = async () => {
    setSaving(true);
    const dirty = rows.filter(r => r._dirty);
    for (const r of dirty) {
      if (!r.enabled && !r.is_blocked) {
        // Remove row entirely
        if (r.existingId) await supabase.from('site_allowed_items' as any).delete().eq('id', r.existingId);
      } else {
        const payload: any = {
          shipping_address_id: shippingAddressId,
          internal_item_id: r.internal_item_id,
          is_blocked: r.is_blocked,
          is_default_for_category: r.is_default_for_category,
          fixture_type: r.fixture_type || null,
          notes: r.notes || null,
        };
        if (r.existingId) await supabase.from('site_allowed_items' as any).update(payload).eq('id', r.existingId);
        else await supabase.from('site_allowed_items' as any).insert(payload);
      }
    }
    toast.success('נשמר'); setSaving(false); setEditMode(false); load();
  };

  const dirtyCount = rows.filter(r => r._dirty).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">מוצרים מותרים באתר – {siteName}</h3>
          <p className="text-xs text-muted-foreground">בחר איזה מוצרים מהקטלוג הפנימי מנהלי אזור יכולים להזמין לאתר זה. אם לא הוגדר דבר – כל המוצרים מותרים.</p>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4 ml-1" /> עריכה</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}><X className="h-4 w-4 ml-1" /> בטל</Button>
              <Button size="sm" onClick={save} disabled={saving || dirtyCount === 0}><Save className="h-4 w-4 ml-1" /> שמור ({dirtyCount})</Button>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2 text-right">מותר</th>
              <th className="p-2 text-right">חסום</th>
              <th className="p-2 text-right">מוצר</th>
              <th className="p-2 text-right">קטגוריה</th>
              <th className="p-2 text-right">ברירת מחדל בקטגוריה</th>
              <th className="p-2 text-right">סוג מתקן</th>
              <th className="p-2 text-right">הערות התאמה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.internal_item_id} className={r._dirty ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                <td className="p-1 text-center"><Checkbox disabled={!editMode || r.is_blocked} checked={r.enabled && !r.is_blocked} onCheckedChange={v => update(r.internal_item_id, { enabled: !!v, is_blocked: false })} /></td>
                <td className="p-1 text-center"><Checkbox disabled={!editMode} checked={r.is_blocked} onCheckedChange={v => update(r.internal_item_id, { is_blocked: !!v, enabled: v ? false : r.enabled })} /></td>
                <td className="p-1">{r.itemName}</td>
                <td className="p-1 text-muted-foreground">{r.category || '—'}</td>
                <td className="p-1 text-center"><Checkbox disabled={!editMode || !r.enabled} checked={r.is_default_for_category} onCheckedChange={v => update(r.internal_item_id, { is_default_for_category: !!v })} /></td>
                <td className="p-1">{editMode ? <Input className="h-8" value={r.fixture_type} onChange={e => update(r.internal_item_id, { fixture_type: e.target.value })} /> : r.fixture_type}</td>
                <td className="p-1">{editMode ? <Input className="h-8" value={r.notes} onChange={e => update(r.internal_item_id, { notes: e.target.value })} /> : r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
