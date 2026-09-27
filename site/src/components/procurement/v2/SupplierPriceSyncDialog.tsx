import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface Props {
  supplierId: string;
  supplierName?: string;
  onDone?: () => void;
}

interface DiffRow {
  id: string;
  sku: string;
  name: string;
  oldPrice: number;
  newPrice: number;
  diff: number;
}

const normSku = (v: any) => String(v ?? '').replace(/[\u200f\u200e\s]/g, '').trim();

const parseNumber = (v: any): number => {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v).replace(/[\u200f\u200e\u00a0]/g, '').replace(/[₪$€,]/g, '').trim();
  s = s.replace(/ש[״"]?ח/g, '').replace(/שקל(ים)?/g, '').replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
};

export const SupplierPriceSyncDialog = ({ supplierId, supplierName, onDone }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [unchanged, setUnchanged] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [done, setDone] = useState<{ updated: number; unchanged: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setDiffs([]); setUnchanged(0); setSkipped([]); setDone(null); };

  const analyze = async (file: File) => {
    setLoading(true); reset();
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellText: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1, raw: false });
      if (!aoa.length) { toast.error('הקובץ ריק'); setLoading(false); return; }

      const norm = (v: any) => String(v ?? '').replace(/["'\u200f\u200e]/g, '').trim();
      let headerIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 10); i++) {
        const cells = aoa[i].map(norm);
        if (cells.some(c => c.includes('מק"ט') || c.includes('מקט')) && cells.some(c => c.includes('מחיר'))) {
          headerIdx = i; break;
        }
      }
      if (headerIdx === -1) { toast.error('לא נמצאה שורת כותרות (מק"ט / מחיר)'); setLoading(false); return; }

      const header = aoa[headerIdx].map(norm);
      const idxSku = header.findIndex(h => h.includes('מק"ט') || h.includes('מקט'));
      const idxPrice = header.findIndex(h => h.includes('מחיר'));
      if (idxSku < 0 || idxPrice < 0) { toast.error('חסרה עמודת מק"ט או מחיר'); setLoading(false); return; }

      const fileMap = new Map<string, number>();
      for (const row of aoa.slice(headerIdx + 1)) {
        const sku = normSku(row[idxSku]);
        const price = parseNumber(row[idxPrice]);
        if (!sku || !isFinite(price)) continue;
        fileMap.set(sku, price);
      }

      const { data: current, error } = await supabase
        .from('supplier_catalog_items')
        .select('id, supplier_sku, supplier_product_name, unit_price')
        .eq('supplier_id', supplierId);
      if (error) { toast.error('שגיאה בקריאת מחירון: ' + error.message); setLoading(false); return; }

      const currentMap = new Map<string, any>();
      for (const r of current || []) currentMap.set(normSku(r.supplier_sku), r);

      const diffRows: DiffRow[] = [];
      let same = 0;
      const skippedSkus: string[] = [];
      for (const [sku, newPrice] of fileMap.entries()) {
        const row = currentMap.get(sku);
        if (!row) { skippedSkus.push(sku); continue; }
        const oldPrice = Number(row.unit_price) || 0;
        if (Math.abs(oldPrice - newPrice) < 0.005) { same++; continue; }
        diffRows.push({
          id: row.id,
          sku: row.supplier_sku,
          name: row.supplier_product_name || '',
          oldPrice, newPrice,
          diff: newPrice - oldPrice,
        });
      }

      setDiffs(diffRows);
      setUnchanged(same);
      setSkipped(skippedSkus);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setSaving(true);
    let ok = 0;
    for (const d of diffs) {
      const { error } = await supabase.from('supplier_catalog_items').update({ unit_price: d.newPrice }).eq('id', d.id);
      if (error) { toast.error(`שגיאה בעדכון ${d.sku}: ${error.message}`); continue; }
      ok++;
    }
    setSaving(false);
    setDone({ updated: ok, unchanged, skipped: skipped.length });
    toast.success(`עודכנו ${ok} מוצרים`);
    onDone?.();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ''; }} />
      <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={loading}>
        <RefreshCw className={`h-4 w-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
        סנכרון מחירים בלבד
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { reset(); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>עדכון מחירון — {supplierName || 'ספק'}</DialogTitle>
          </DialogHeader>

          {!done ? (
            <>
              <div className="text-sm bg-muted/50 p-3 rounded-md border flex gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  סנכרון מחירים בלבד לפי מק"ט. <b>לא</b> נוצרים מוצרים חדשים, לא נמחקים ולא משתנים שמות/מארזים/איכות/הערות.
                  שינוי חל אך ורק על "מחיר ליח' לפני מע"מ".
                </div>
              </div>

              <div className="flex gap-4 text-sm mt-2">
                <span className="text-amber-700">שינויים לעדכון: <b>{diffs.length}</b></span>
                <span className="text-muted-foreground">ללא שינוי: <b>{unchanged}</b></span>
                <span className="text-muted-foreground">דולגו (לא קיימים בספק): <b>{skipped.length}</b></span>
              </div>

              <div className="border rounded-md overflow-auto flex-1 min-h-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-right">מק"ט</th>
                      <th className="p-2 text-right">שם מוצר במערכת</th>
                      <th className="p-2 text-right">מחיר קיים</th>
                      <th className="p-2 text-right">מחיר חדש</th>
                      <th className="p-2 text-right">פער</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map(d => (
                      <tr key={d.id} className="border-t">
                        <td className="p-2">{d.sku}</td>
                        <td className="p-2">{d.name}</td>
                        <td className="p-2">₪{d.oldPrice.toFixed(2)}</td>
                        <td className="p-2 font-semibold">₪{d.newPrice.toFixed(2)}</td>
                        <td className={`p-2 ${d.diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {d.diff > 0 ? '+' : ''}₪{d.diff.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {diffs.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">אין הפרשי מחירים לעדכון.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>ביטול</Button>
                <Button onClick={confirm} disabled={saving || diffs.length === 0}>
                  {saving ? 'מעדכן...' : `אשר עדכון מחירון ${supplierName || ''}`}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 space-y-3">
              <div className="text-lg font-semibold text-green-700">הסנכרון הסתיים בהצלחה</div>
              <ul className="text-sm space-y-1">
                <li>עודכנו: <b>{done.updated}</b> מוצרים</li>
                <li>ללא שינוי: <b>{done.unchanged}</b> מוצרים</li>
                <li>דולגו כי לא קיימים בספק: <b>{done.skipped}</b> מוצרים</li>
              </ul>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>סגור</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
