import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, X, Pencil, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { SupplierPriceSyncDialog } from './SupplierPriceSyncDialog';

interface Row {
  id?: string;
  _clientId: string;
  _dirty?: boolean;
  _deleted?: boolean;
  _new?: boolean;
  internal_item_id: string | null;
  category: string;
  supplier_sku: string;
  supplier_product_name: string;
  unit_price: number;
  pack_size: number;
  vat_rate: number;
  purchase_unit: string;
  notes: string;
  active: boolean;
  quality: 'basic' | 'standard' | 'premium';
}

const emptyRow = (): Row => ({
  _clientId: crypto.randomUUID(),
  _new: true,
  internal_item_id: null,
  category: '',
  supplier_sku: '',
  supplier_product_name: '',
  unit_price: 0,
  pack_size: 1,
  vat_rate: 0.17,
  purchase_unit: 'יחידה',
  notes: '',
  active: true,
  quality: 'standard',
});

const qualityHe = { basic: 'בסיסי', standard: 'רגיל', premium: 'פרימיום' } as const;
const qualityFromHe: Record<string, Row['quality']> = { 'בסיסי': 'basic', 'רגיל': 'standard', 'פרימיום': 'premium' };

export const SupplierPriceListEditor = ({ supplierId, supplierName }: { supplierId: string; supplierName?: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [original, setOriginal] = useState<Row[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: sci }, { data: it }] = await Promise.all([
      supabase.from('supplier_catalog_items').select('*').eq('supplier_id', supplierId).order('created_at'),
      supabase.from('internal_catalog_items').select('id,name,category').eq('active', true).order('name'),
    ]);
    const mapped: Row[] = (sci || []).map((r: any) => ({
      id: r.id, _clientId: r.id,
      internal_item_id: r.internal_item_id,
      category: r.category || '',
      supplier_sku: r.supplier_sku || '',
      supplier_product_name: r.supplier_product_name || '',
      unit_price: Number(r.unit_price) || 0,
      pack_size: Number(r.pack_size) || 1,
      vat_rate: r.vat_rate != null ? Number(r.vat_rate) : 0.17,
      purchase_unit: r.purchase_unit || 'יחידה',
      notes: r.notes || '',
      active: r.active ?? true,
      quality: r.quality || 'standard',
    }));
    setRows(mapped);
    setOriginal(JSON.parse(JSON.stringify(mapped)));
    setItems(it || []);
  };
  useEffect(() => { load(); }, [supplierId]);

  const update = (cid: string, patch: Partial<Row>) => {
    setRows(rs => rs.map(r => r._clientId === cid ? { ...r, ...patch, _dirty: true } : r));
  };
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const markDelete = (cid: string) => {
    setRows(rs => rs.map(r => r._clientId === cid ? { ...r, _deleted: true, _dirty: true } : r).filter(r => !(r._new && r._deleted)));
  };

  const cancel = () => {
    setRows(JSON.parse(JSON.stringify(original)));
    setEditMode(false);
  };

  const save = async () => {
    setSaving(true);
    const toDelete = rows.filter(r => r._deleted && r.id).map(r => r.id!);
    const toUpsert = rows.filter(r => !r._deleted && r._dirty).map(r => ({
      id: r.id,
      supplier_id: supplierId,
      internal_item_id: r.internal_item_id,
      category: r.category || null,
      supplier_sku: r.supplier_sku || null,
      supplier_product_name: r.supplier_product_name || null,
      unit_price: Number(r.unit_price) || 0,
      pack_size: Number(r.pack_size) || 1,
      vat_rate: Number(r.vat_rate) || 0,
      purchase_unit: r.purchase_unit || 'יחידה',
      notes: r.notes || null,
      active: r.active,
      quality: r.quality,
    }));

    if (toDelete.length) {
      const { error } = await supabase.from('supplier_catalog_items').delete().in('id', toDelete);
      if (error) { toast.error('שגיאה במחיקה'); setSaving(false); return; }
    }
    for (const row of toUpsert) {
      if (row.id) {
        const { id, ...patch } = row;
        const { error } = await supabase.from('supplier_catalog_items').update(patch).eq('id', id);
        if (error) { toast.error(`שגיאה: ${error.message}`); setSaving(false); return; }
      } else {
        const { id: _, ...ins } = row as any;
        const { error } = await supabase.from('supplier_catalog_items').insert(ins);
        if (error) { toast.error(`שגיאה: ${error.message}`); setSaving(false); return; }
      }
    }
    toast.success('השינויים נשמרו');
    setSaving(false);
    setEditMode(false);
    load();
  };

  const exportExcel = () => {
    const data = rows.filter(r => !r._deleted).map(r => ({
      'מק"ט': r.supplier_sku,
      'שם המוצר': r.supplier_product_name,
      'מחיר ליח\' לפני מע"מ': r.unit_price,
      'יח\' במארז': r.pack_size,
      'סטטוס מוצר': r.active ? 'פעיל' : 'לא פעיל',
      'הערות': r.notes,
      'איכות מוצר': qualityHe[r.quality],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'מחירון');
    XLSX.writeFile(wb, `מחירון-${supplierName || 'ספק'}.xlsx`);
  };

  const parseNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    // Strip RTL marks, currency, whitespace, thousand separators — keep digits, dot, minus
    let s = String(v).replace(/[\u200f\u200e\u00a0]/g, '').replace(/[₪$€,]/g, '').trim();
    // Handle Hebrew "שח"/"שקל"
    s = s.replace(/ש[״"]?ח/g, '').replace(/שקל(ים)?/g, '').trim();
    // Remove any non-numeric except . and -
    s = s.replace(/[^\d.\-]/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  const importExcel = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellText: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Read as arrays to locate the header row robustly (some files have title rows above)
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1, raw: false });
    if (!aoa.length) { toast.error('הקובץ ריק'); return; }

    const norm = (v: any) => String(v ?? '').replace(/["'\u200f\u200e]/g, '').trim();

    // Find header row: the row containing "מק"ט" or "שם" within first 10 rows
    let headerIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const cells = aoa[i].map(norm);
      if (cells.some(c => c.includes('מק"ט') || c.includes('מקט') || c.toLowerCase() === 'sku') &&
          cells.some(c => c.includes('שם'))) {
        headerIdx = i; break;
      }
    }
    if (headerIdx === -1) headerIdx = 0;
    const header = aoa[headerIdx].map(norm);

    const findCol = (keys: string[]) => header.findIndex(h => {
      const hl = h.toLowerCase();
      return keys.some(k => hl.includes(k.toLowerCase()));
    });

    const idxSku = findCol(['מק"ט', 'מקט', 'sku', 'קטלוגי']);
    const idxName = findCol(['שם המוצר', 'שם מוצר', 'שם', 'תיאור', 'name', 'product']);
    const idxPrice = findCol(['מחיר ליח', 'מחיר יח', 'מחיר יחידה', 'מחיר', 'price']);
    const idxPack = findCol(['יח\' במארז', 'יח במארז', 'יחידות במארז', 'מארז', 'pack']);
    const idxStatus = findCol(['סטטוס', 'פעיל', 'active', 'status']);
    const idxNotes = findCol(['הערות', 'notes']);
    const idxQuality = findCol(['איכות', 'quality']);

    const dataRows = aoa.slice(headerIdx + 1);
    let withPrice = 0, withoutPrice = 0;
    const imported: Row[] = dataRows.map(row => {
      const sku = idxSku >= 0 ? String(row[idxSku] ?? '').trim() : '';
      const name = idxName >= 0 ? String(row[idxName] ?? '').trim() : '';
      const price = idxPrice >= 0 ? parseNumber(row[idxPrice]) : 0;
      const pack = idxPack >= 0 ? parseNumber(row[idxPack]) : 0;
      const statusRaw = idxStatus >= 0 ? String(row[idxStatus] ?? '').trim().toLowerCase() : '';
      const active = statusRaw === '' ? true : !['לא פעיל', 'לא', 'false', '0', 'inactive', 'no'].includes(statusRaw);
      const notes = idxNotes >= 0 ? String(row[idxNotes] ?? '').trim() : '';
      const qualityRaw = idxQuality >= 0 ? String(row[idxQuality] ?? '').trim() : '';
      const quality = qualityFromHe[qualityRaw] || 'standard';
      if (price > 0) withPrice++; else if (sku || name) withoutPrice++;
      return {
        _clientId: crypto.randomUUID(), _new: true, _dirty: true,
        internal_item_id: null,
        category: '',
        supplier_sku: sku,
        supplier_product_name: name,
        unit_price: price,
        pack_size: pack > 0 ? pack : 1,
        vat_rate: 0.17,
        purchase_unit: 'יחידה',
        notes,
        active,
        quality,
      };
    }).filter(r => r.supplier_sku || r.supplier_product_name);

    if (!imported.length) { toast.error('לא נמצאו שורות תקינות (חסרים מק"ט/שם מוצר)'); return; }
    setRows(rs => [...rs, ...imported]);
    setEditMode(true);
    const msg = `יובאו ${imported.length} שורות • ${withPrice} עם מחיר${withoutPrice ? ` • ${withoutPrice} ללא מחיר (לבדיקה)` : ''}. לחץ "שמור שינויים" לאישור.`;
    if (withoutPrice > 0) toast.warning(msg, { duration: 8000 });
    else toast.success(msg);
  };

  const dirtyCount = rows.filter(r => r._dirty).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {editMode ? `מצב עריכה • ${dirtyCount} שינויים לא שמורים` : `מצב תצוגה • ${rows.filter(r => !r._deleted).length} שורות`}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 ml-1" /> ייצוא לאקסל</Button>
          <SupplierPriceSyncDialog supplierId={supplierId} supplierName={supplierName} onDone={load} />
          {!editMode ? (
            <>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 ml-1" /> ייבוא מאקסל</Button>
              <Button size="sm" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4 ml-1" /> ערוך מחירון</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 ml-1" /> ייבוא מאקסל</Button>
              <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 ml-1" /> הוסף שורה</Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}><X className="h-4 w-4 ml-1" /> בטל שינויים</Button>
              <Button size="sm" onClick={save} disabled={saving || dirtyCount === 0}><Save className="h-4 w-4 ml-1" /> שמור שינויים</Button>
            </>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ''; }} />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto" dir="rtl">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2 text-right">מק"ט</th>
              <th className="p-2 text-right">שם המוצר</th>
              <th className="p-2 text-right">מחיר ליח' לפני מע"מ</th>
              <th className="p-2 text-right">יח' במארז</th>
              <th className="p-2 text-right">סטטוס מוצר</th>
              <th className="p-2 text-right">הערות</th>
              <th className="p-2 text-right">איכות מוצר</th>
              {editMode && <th className="p-2 text-right text-muted-foreground">מוצר פנימי משויך</th>}
              {editMode && <th className="p-2 text-right"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => !r._deleted).map(r => {
              const readOnly = !editMode;
              return (
                <tr key={r._clientId} className={r._dirty ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                  <td className="p-1">{readOnly ? r.supplier_sku : <Input className="h-8 w-24" value={r.supplier_sku} onChange={e => update(r._clientId, { supplier_sku: e.target.value })} />}</td>
                  <td className="p-1">{readOnly ? r.supplier_product_name : <Input className="h-8 min-w-40" value={r.supplier_product_name} onChange={e => update(r._clientId, { supplier_product_name: e.target.value })} />}</td>
                  <td className="p-1">{readOnly ? `₪${r.unit_price.toFixed(2)}` : <Input className="h-8 w-24" type="number" step="0.01" value={r.unit_price} onChange={e => update(r._clientId, { unit_price: parseFloat(e.target.value) || 0 })} />}</td>
                  <td className="p-1">{readOnly ? r.pack_size : <Input className="h-8 w-20" type="number" step="0.01" value={r.pack_size} onChange={e => update(r._clientId, { pack_size: parseFloat(e.target.value) || 1 })} />}</td>
                  <td className="p-1">
                    {readOnly ? (
                      <span className={r.active ? 'text-green-700 font-medium' : 'text-muted-foreground'}>{r.active ? 'פעיל' : 'לא פעיל'}</span>
                    ) : (
                      <Select value={r.active ? 'active' : 'inactive'} onValueChange={v => update(r._clientId, { active: v === 'active' })}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">פעיל</SelectItem>
                          <SelectItem value="inactive">לא פעיל</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="p-1">{readOnly ? r.notes : <Input className="h-8 min-w-32" value={r.notes} onChange={e => update(r._clientId, { notes: e.target.value })} />}</td>
                  <td className="p-1">
                    {readOnly ? qualityHe[r.quality] : (
                      <Select value={r.quality} onValueChange={v => update(r._clientId, { quality: v as any })}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">בסיסי</SelectItem>
                          <SelectItem value="standard">רגיל</SelectItem>
                          <SelectItem value="premium">פרימיום</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  {editMode && (
                    <td className="p-1">
                      <Select value={r.internal_item_id || 'none'} onValueChange={v => update(r._clientId, { internal_item_id: v === 'none' ? null : v })}>
                        <SelectTrigger className="h-8 min-w-32"><SelectValue placeholder="— ללא —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— ללא —</SelectItem>
                          {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {editMode && (
                    <td className="p-1">
                      <Button size="icon" variant="ghost" onClick={() => markDelete(r._clientId)} title="מחק שורה"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.filter(r => !r._deleted).length === 0 && (
              <tr><td colSpan={editMode ? 9 : 7} className="p-4 text-center text-muted-foreground">אין פריטים במחירון. לחץ "ערוך מחירון" ואז "הוסף שורה" או "ייבוא מאקסל".</td></tr>
            )}
          </tbody>
        </table>
        {editMode && (
          <div className="p-2 text-[11px] text-muted-foreground border-t bg-muted/30">
            <b>מוצר פנימי משויך</b> — קושר בין שורת מחירון הספק למוצר הפנימי שמוצג למנהלי האזור. חובה למילוי כדי שהמוצר יעלה כאופציה בעת אישור הזמנה.
          </div>
        )}
      </div>

    </div>
  );
};
