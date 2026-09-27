import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, Star, Truck, Package, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SupplierPriceListEditor } from './SupplierPriceListEditor';
import { LinkSupplierItemsDialog } from './LinkSupplierItemsDialog';

interface Contact { name: string; phone: string; email: string; is_default: boolean; }

// ============ Main tabbed manager ============
export const InternalCatalogManager = () => {
  return (
    <Tabs defaultValue="pricelists" className="w-full">
      <TabsList>
        <TabsTrigger value="pricelists"><Truck className="h-4 w-4 ml-1" /> מחירוני ספקים</TabsTrigger>
        <TabsTrigger value="internal"><Package className="h-4 w-4 ml-1" /> קטלוג פנימי</TabsTrigger>
      </TabsList>
      <TabsContent value="pricelists" className="mt-4"><SupplierPriceListsScreen /></TabsContent>
      <TabsContent value="internal" className="mt-4"><InternalCatalogScreen /></TabsContent>
    </Tabs>
  );
};

// ============ Supplier price lists screen ============
const emptySupplier = () => ({ name: '', address: '', notes: '', active: true, contacts: [{ name: '', phone: '', email: '', is_default: true }] as Contact[] });

const SupplierPriceListsScreen = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
    if (!selectedId && data && data.length) setSelectedId(data[0].id);
  };
  useEffect(() => { load(); }, []);

  const selected = suppliers.find(s => s.id === selectedId);

  const openNew = () => { setEditing(emptySupplier()); setOpen(true); };
  const openEdit = () => {
    if (!selected) return;
    setEditing({ ...selected, contacts: (selected.contacts?.length ? selected.contacts : [{ name: '', phone: '', email: '', is_default: true }]) });
    setOpen(true);
  };

  const saveSupplier = async () => {
    if (!editing?.name) { toast.error('שם ספק חובה'); return; }
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
    if (editing.id) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id);
    } else {
      const { data } = await supabase.from('suppliers').insert(payload).select().single();
      if (data) setSelectedId(data.id);
    }
    toast.success('נשמר');
    setOpen(false); setEditing(null); load();
  };

  const deleteSupplier = async () => {
    if (!selected) return;
    if (!confirm(`למחוק את הספק "${selected.name}" ואת כל המחירון שלו?`)) return;
    await supabase.from('suppliers').delete().eq('id', selected.id);
    setSelectedId('');
    load();
  };

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
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>מחירוני ספקים</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 ml-1" /> הוסף ספק</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">בחר ספק:</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="בחר ספק" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{!s.active && ' (לא פעיל)'}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected && (
            <>
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 ml-1" /> ערוך כרטיס ספק</Button>
              <Button size="sm" variant="ghost" onClick={deleteSupplier}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </>
          )}
        </div>
        {selected && (
          <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/40">
            <div className="font-medium text-sm text-foreground mb-1">{selected.name} {!selected.active && <Badge variant="outline" className="mr-1">לא פעיל</Badge>}</div>
            {(selected.contacts || []).length > 0 ? (
              <div className="space-y-0.5">
                {(selected.contacts as Contact[]).map((c, i) => (
                  <div key={i}>{c.is_default && <Star className="inline h-3 w-3 text-primary ml-1" />}{c.name || '—'} • {c.phone || '—'} • {c.email || '—'}</div>
                ))}
              </div>
            ) : <div>ללא אנשי קשר</div>}
            {selected.notes && <div className="mt-1">הערות: {selected.notes}</div>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {selected ? (
          <SupplierPriceListEditor supplierId={selected.id} supplierName={selected.name} />
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {suppliers.length === 0 ? 'אין ספקים. לחץ "הוסף ספק" להתחלה.' : 'בחר ספק כדי לצפות במחירון.'}
          </div>
        )}
      </CardContent>

      {/* Supplier editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>שם ספק *</Label><Input value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>כתובת</Label><Input value={editing?.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><Label>הערות ספק</Label><Textarea value={editing?.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">אנשי קשר / מיילים להזמנה</Label>
                <Button size="sm" variant="outline" onClick={addContact}><Plus className="h-4 w-4 ml-1" /> הוסף</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">איש הקשר המסומן כברירת מחדל יופיע כברירת מחדל בשליחת ההזמנות.</p>
              <div className="space-y-2">
                {(editing?.contacts || []).map((c: Contact, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                    <div className="col-span-3"><Label className="text-xs">שם</Label><Input value={c.name} onChange={e => updateContact(i, { name: e.target.value })} /></div>
                    <div className="col-span-3"><Label className="text-xs">טלפון</Label><Input value={c.phone} onChange={e => updateContact(i, { phone: e.target.value })} /></div>
                    <div className="col-span-4"><Label className="text-xs">אימייל להזמנה</Label><Input type="email" value={c.email} onChange={e => updateContact(i, { email: e.target.value })} /></div>
                    <div className="col-span-1 flex items-center gap-1 pb-2">
                      <Checkbox checked={c.is_default} onCheckedChange={v => updateContact(i, { is_default: !!v })} />
                      <span className="text-[10px]">בררת מחדל</span>
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
            <Button onClick={saveSupplier} className="w-full">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ============ Internal (generic) catalog — Excel style ============
const PERMISSIONS = ['region_manager', 'admin_only'] as const;
const permLabel = (p: string) => p === 'admin_only' ? 'אדמין בלבד' : 'מנהל אזור';

const InternalCatalogScreen = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [original, setOriginal] = useState<any[]>([]);
  const [links, setLinks] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from('internal_catalog_items').select('*').order('name');
    const list = (data || []).map(r => ({ ...r }));
    setRows(list);
    setOriginal(JSON.parse(JSON.stringify(list)));
    setDirtyIds(new Set()); setDeletedIds([]);
    const sup = await supabase.from('supplier_catalog_items').select('internal_item_id');
    const map: Record<string, number> = {};
    (sup.data || []).forEach((s: any) => { map[s.internal_item_id] = (map[s.internal_item_id] || 0) + 1; });
    setLinks(map);
  };
  useEffect(() => { load(); }, []);

  const markDirty = (id: string) => setDirtyIds(prev => new Set(prev).add(id));
  const update = (i: number, patch: any) => {
    const list = [...rows]; list[i] = { ...list[i], ...patch }; setRows(list);
    if (list[i].id) markDirty(list[i].id);
  };
  const addRow = () => setRows([{ _tmp: crypto.randomUUID(), name: '', permission: 'region_manager', category: '', active: true, notes: '' }, ...rows]);
  const removeRow = (i: number) => {
    const r = rows[i]; if (!confirm('למחוק שורה?')) return;
    if (r.id) setDeletedIds(prev => [...prev, r.id]);
    setRows(rows.filter((_, idx) => idx !== i));
  };

  const cancelEdit = () => { setRows(JSON.parse(JSON.stringify(original))); setDirtyIds(new Set()); setDeletedIds([]); setEditMode(false); };

  const save = async () => {
    setSaving(true);
    try {
      if (deletedIds.length) await supabase.from('internal_catalog_items').delete().in('id', deletedIds);
      const news = rows.filter(r => !r.id && r.name?.trim());
      if (news.length) {
        await supabase.from('internal_catalog_items').insert(news.map(r => ({
          name: r.name.trim(), category: r.category || null, permission: r.permission || 'region_manager',
          active: r.active ?? true, notes: r.notes || null, unit_of_measure: r.unit_of_measure || 'יחידה',
        })));
      }
      for (const r of rows) {
        if (r.id && dirtyIds.has(r.id)) {
          await supabase.from('internal_catalog_items').update({
            name: r.name, category: r.category || null, permission: r.permission || 'region_manager',
            active: r.active ?? true, notes: r.notes || null,
          }).eq('id', r.id);
        }
      }
      toast.success('נשמר');
      setEditMode(false);
      await load();
    } catch (e: any) { toast.error(e.message || 'שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  const importExcel = async (file: File) => {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Read as arrays so we can also handle files without headers (col A/B by position)
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
    if (!aoa.length) { toast.error('הקובץ ריק'); return; }

    // Detect header row (contains "שם מוצר" or "name")
    const norm = (v: any) => String(v ?? '').replace(/["'\u200f\u200e]/g, '').trim().toLowerCase();
    const header = aoa[0].map(norm);
    const hasHeader = header.some(h => h.includes('שם') || h === 'name' || h.includes('הרשאה') || h.includes('קטגוריה'));

    const findIdx = (keys: string[]) => header.findIndex(h => keys.some(k => h.includes(k)));
    const idxName = hasHeader ? findIdx(['שם מוצר', 'שם פנימי', 'name']) : 1;
    const idxPerm = hasHeader ? findIdx(['הרשאה', 'permission']) : 0;
    const idxCat = hasHeader ? findIdx(['קטגוריה', 'category']) : -1;
    const idxActive = hasHeader ? findIdx(['פעיל', 'active', 'סטטוס']) : -1;
    const idxNotes = hasHeader ? findIdx(['הערות', 'notes']) : -1;
    const idxRelated = hasHeader ? findIdx(['מוצרים קשורים', 'related']) : -1;

    const startRow = hasHeader ? 1 : 0;
    const rowsIn = aoa.slice(startRow);

    const mapped = rowsIn.map((row) => {
      const name = String(row[idxName] ?? '').trim();
      const permRaw = idxPerm >= 0 ? String(row[idxPerm] ?? '').trim() : '';
      const perm = permRaw ? (permRaw.includes('אדמין') || permRaw.toLowerCase().includes('admin') ? 'admin_only' : 'region_manager') : 'region_manager';
      const category = idxCat >= 0 ? String(row[idxCat] ?? '').trim() : '';
      const activeRaw = idxActive >= 0 ? String(row[idxActive] ?? '').trim().toLowerCase() : '';
      const active = activeRaw === '' ? true : !['לא פעיל','לא','false','0','inactive','no'].includes(activeRaw);
      const notes = idxNotes >= 0 ? String(row[idxNotes] ?? '').trim() : '';
      const related = idxRelated >= 0 ? String(row[idxRelated] ?? '').trim() : '';
      return { name, permission: perm, category, active, notes, related };
    }).filter(r => r.name);

    if (!mapped.length) { toast.error('לא נמצאו שורות עם "שם מוצר"'); return; }

    const payload = mapped.map(r => ({
      name: r.name,
      permission: r.permission,
      category: r.category || null,
      active: r.active,
      notes: [r.notes, r.related ? `מוצרים קשורים: ${r.related}` : ''].filter(Boolean).join(' | ') || null,
      unit_of_measure: 'יחידה',
    }));
    const { error } = await supabase.from('internal_catalog_items').insert(payload);
    if (error) { toast.error('שגיאה בייבוא: ' + error.message); return; }
    toast.success(`יובאו ${payload.length} מוצרים לקטלוג הפנימי`);
    load();
  };

  const exportTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet([
      { 'שם מוצר פנימי': 'נייר ידיים', 'הרשאה': 'מנהל אזור', 'קטגוריה': 'ניקיון', 'פעיל': 'כן', 'הערות': '', 'מוצרים קשורים': '' },
      { 'שם מוצר פנימי': 'סבון ידיים', 'הרשאה': 'מנהל אזור', 'קטגוריה': 'ניקיון', 'פעיל': 'כן', 'הערות': '', 'מוצרים קשורים': '' },
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'קטלוג פנימי');
    XLSX.writeFile(wb, 'internal_catalog_template.xlsx');
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>קטלוג פנימי</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">רשימת מוצרים כלליים שרואים מנהלי האזור. שיוך לספקים נעשה במחירון של הספק ובאישור הזמנה.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={exportTemplate}>הורד תבנית</Button>
                <label>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ''; }} />
                  <Button size="sm" variant="outline" asChild><span><Package className="h-4 w-4 ml-1" /> ייבוא קטלוג פנימי מאקסל</span></Button>
                </label>
                <Button size="sm" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4 ml-1" /> ערוך קטלוג</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 ml-1" /> הוסף שורה</Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>בטל שינויים</Button>
                <Button size="sm" onClick={save} disabled={saving}>שמור שינויים</Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <table dir="rtl" className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-right p-2 font-medium">שם מוצר פנימי</th>
                <th className="text-right p-2 font-medium">הרשאה</th>
                <th className="text-right p-2 font-medium">קטגוריה</th>
                <th className="text-right p-2 font-medium">פעיל</th>
                <th className="text-right p-2 font-medium">הערות</th>
                <th className="text-right p-2 font-medium">מוצרים מקושרים</th>
                {editMode && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || r._tmp} className="border-t">
                  <td className="p-1">
                    {editMode ? <Input value={r.name || ''} onChange={e => update(i, { name: e.target.value })} className="h-8" />
                              : <span className="px-2">{r.name}</span>}
                  </td>
                  <td className="p-1">
                    {editMode ? (
                      <Select value={r.permission || 'region_manager'} onValueChange={v => update(i, { permission: v })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{PERMISSIONS.map(p => <SelectItem key={p} value={p}>{permLabel(p)}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{permLabel(r.permission || 'region_manager')}</Badge>}
                  </td>
                  <td className="p-1">
                    {editMode ? <Input value={r.category || ''} onChange={e => update(i, { category: e.target.value })} className="h-8" />
                              : <span className="px-2 text-muted-foreground">{r.category || '—'}</span>}
                  </td>
                  <td className="p-1 text-center">
                    <Checkbox checked={r.active ?? true} disabled={!editMode} onCheckedChange={v => update(i, { active: !!v })} />
                  </td>
                  <td className="p-1">
                    {editMode ? <Input value={r.notes || ''} onChange={e => update(i, { notes: e.target.value })} className="h-8" />
                              : <span className="px-2 text-muted-foreground">{r.notes || '—'}</span>}
                  </td>
                  <td className="p-1 text-center">
                    {r.id ? (
                      <Button size="sm" variant={links[r.id] ? 'default' : 'outline'} onClick={() => setLinkDialog({ id: r.id, name: r.name })} className="gap-1">
                        <LinkIcon className="h-3.5 w-3.5" />
                        שייך מוצרי ספק
                        <Badge variant="secondary" className="mr-1">{links[r.id] || 0}</Badge>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">שמור תחילה</span>
                    )}
                  </td>
                  {editMode && (
                    <td className="p-1">
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={editMode ? 7 : 6} className="text-center text-muted-foreground py-6">אין מוצרים פנימיים. ייבא מאקסל או הוסף ידנית.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
      {linkDialog && (
        <LinkSupplierItemsDialog
          internalItemId={linkDialog.id}
          internalItemName={linkDialog.name}
          open={!!linkDialog}
          onOpenChange={(v) => { if (!v) setLinkDialog(null); }}
          onSaved={load}
        />
      )}
    </Card>
  );
};
