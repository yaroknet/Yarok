import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Filter, Pencil, Wrench } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Repair {
  id: string;
  repair_supplier: string | null;
  invoice_number: string | null;
  repair_date: string | null;
  location_text: string | null;
  machine_number: string | null;
  equipment_type: string | null;
  description: string | null;
  cost_excl_vat: number | null;
  is_approved: string | null;
}

const DEFAULT_SUPPLIERS = ['רנמ', 'רתמ', 'סנו', 'אלרז', 'מורן', 'זוהר פיקס'];
const DEFAULT_APPROVERS = ['אורית'];

type Sort = { key: keyof Repair; dir: 'asc' | 'desc' } | null;
type ColFilters = Partial<Record<keyof Repair, { text?: string; picks?: string[]; from?: string; to?: string; min?: string; max?: string }>>;

// ---- inline cells ----
function EditableTextCell({ value, onSave, type = 'text', multiline = false }: { value: any; onSave: (v: any) => any; type?: 'text' | 'number' | 'date'; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<string>(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = async () => {
    const newVal = type === 'number' ? (v === '' ? null : Number(v)) : (v === '' ? null : v);
    if ((value ?? '') === (newVal ?? '')) { setEditing(false); return; }
    await onSave(newVal);
    setEditing(false);
  };
  if (!editing) return (
    <div onClick={() => setEditing(true)} className="group cursor-text px-2 py-1 rounded hover:bg-accent/40 min-h-[28px] flex items-start justify-between gap-1" title="לחץ לעריכה">
      <span className={multiline ? 'whitespace-normal break-words flex-1' : 'truncate'}>
        {type === 'date' && value ? new Date(value).toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit' }) :
         type === 'number' && value != null ? Number(value).toLocaleString() :
         (value ?? <span className="text-muted-foreground">—</span>)}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0 mt-1" />
    </div>
  );
  return (
    <Input autoFocus type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
      value={v} onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && !multiline) commit(); if (e.key === 'Escape') setEditing(false); }}
      onBlur={commit} className="h-8" />
  );
}

function EditableSelectCell({ value, options, onSave, allowCustom }: { value: string | null; options: string[]; onSave: (v: string) => any; allowCustom?: boolean }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value ?? ''} onValueChange={v => onSave(v)}>
      <SelectTrigger className="h-8 border-transparent hover:border-input bg-transparent hover:bg-accent/40">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ---- header cell with sort + filter ----
function HeaderCell({
  label, sortKey, sort, onSort, filterKind, filters, setFilters, options,
}: {
  label: string; sortKey?: keyof Repair; sort: Sort; onSort: (k: keyof Repair) => void;
  filterKind?: 'text' | 'picks' | 'date' | 'number';
  filters: ColFilters; setFilters: (f: ColFilters) => void; options?: string[];
}) {
  const active = !!(sort && sortKey && sort.key === sortKey);
  const cur = sortKey ? filters[sortKey] : undefined;
  const hasFilter = !!(cur && (cur.text || cur.picks?.length || cur.from || cur.to || cur.min || cur.max));
  return (
    <div dir="rtl" className="flex items-center justify-end gap-1 text-right">
      {sortKey ? (
        <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 font-semibold hover:text-primary text-right">
          {label}
          {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : <span className="font-semibold">{label}</span>}
      {filterKind && sortKey && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className={`h-6 w-6 ${hasFilter ? 'text-primary' : 'opacity-60'}`}>
              <Filter className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent dir="rtl" className="w-56 p-2 text-right" align="start">
            {filterKind === 'text' && (
              <Input dir="rtl" className="text-right" placeholder="סינון..." value={cur?.text ?? ''}
                onChange={e => setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), text: e.target.value } })} />
            )}
            {filterKind === 'picks' && options && (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {options.map(o => {
                  const checked = cur?.picks?.includes(o) ?? false;
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={(c) => {
                        const picks = new Set(cur?.picks ?? []);
                        if (c) picks.add(o); else picks.delete(o);
                        setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), picks: Array.from(picks) } });
                      }} />{o}
                    </label>
                  );
                })}
              </div>
            )}
            {filterKind === 'date' && (
              <div className="space-y-2">
                <div><label className="text-xs">מתאריך</label>
                  <Input type="date" value={cur?.from ?? ''} onChange={e => setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), from: e.target.value } })} /></div>
                <div><label className="text-xs">עד תאריך</label>
                  <Input type="date" value={cur?.to ?? ''} onChange={e => setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), to: e.target.value } })} /></div>
              </div>
            )}
            {filterKind === 'number' && (
              <div className="space-y-2">
                <div><label className="text-xs">מינימום</label>
                  <Input type="number" value={cur?.min ?? ''} onChange={e => setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), min: e.target.value } })} /></div>
                <div><label className="text-xs">מקסימום</label>
                  <Input type="number" value={cur?.max ?? ''} onChange={e => setFilters({ ...filters, [sortKey]: { ...(cur ?? {}), max: e.target.value } })} /></div>
              </div>
            )}
            {hasFilter && (
              <Button size="sm" variant="ghost" className="w-full mt-2"
                onClick={() => { const n = { ...filters }; delete n[sortKey]; setFilters(n); }}>נקה סינון</Button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default function RepairsTab() {
  const [rows, setRows] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'repair_date', dir: 'desc' });
  const [filters, setFilters] = useState<ColFilters>({});
  const [deleting, setDeleting] = useState<Repair | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('machine_repairs').select('*').order('repair_date', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data as any || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const suppliers = useMemo(() => Array.from(new Set([...DEFAULT_SUPPLIERS, ...rows.map(r => r.repair_supplier).filter(Boolean) as string[]])), [rows]);
  const approvers = DEFAULT_APPROVERS;
  const equipmentTypes = useMemo(() => Array.from(new Set(['מכונת שטיפה', 'שואב אבק', ...rows.map(r => r.equipment_type).filter(Boolean) as string[]])), [rows]);
  const locations = useMemo(() => Array.from(new Set(rows.map(r => r.location_text).filter(Boolean) as string[])), [rows]);

  const patch = async (r: Repair, p: Partial<Repair>) => {
    const { error } = await supabase.from('machine_repairs').update(p as any).eq('id', r.id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...p } : x));
  };

  const addRow = async () => {
    const { data, error } = await supabase.from('machine_repairs').insert({
      repair_date: new Date().toISOString().slice(0, 10),
      equipment_type: 'מכונת שטיפה',
      repair_supplier: 'רנמ',
    } as any).select('*').single();
    if (error) return toast.error(error.message);
    setRows(prev => [data as any, ...prev]);
    toast.success('נוספה שורת תיקון חדשה');
  };

  const doDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('machine_repairs').delete().eq('id', deleting.id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.filter(x => x.id !== deleting.id));
    setDeleting(null);
    toast.success('נמחק');
  };

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (search) {
      const s = search.toLowerCase();
      out = out.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(s)));
    }
    for (const [k, cfg] of Object.entries(filters)) {
      const key = k as keyof Repair;
      if (cfg?.text) { const t = cfg.text.toLowerCase(); out = out.filter(r => String(r[key] ?? '').toLowerCase().includes(t)); }
      if (cfg?.picks?.length) out = out.filter(r => cfg.picks!.includes(String(r[key] ?? '')));
      if (cfg?.from) out = out.filter(r => r[key] && String(r[key]) >= cfg.from!);
      if (cfg?.to) out = out.filter(r => r[key] && String(r[key]) <= cfg.to!);
      if (cfg?.min) out = out.filter(r => Number(r[key] ?? 0) >= Number(cfg.min));
      if (cfg?.max) out = out.filter(r => Number(r[key] ?? 0) <= Number(cfg.max));
    }
    if (sort) {
      out.sort((a, b) => {
        const av: any = a[sort.key] ?? ''; const bv: any = b[sort.key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv), 'he') : String(bv).localeCompare(String(av), 'he');
      });
    }
    return out;
  }, [rows, search, filters, sort]);

  const toggleSort = (key: keyof Repair) => {
    setSort(prev => !prev || prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null);
  };

  const totalCost = useMemo(() => filtered.reduce((s, r) => s + (r.cost_excl_vat || 0), 0), [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">סה"כ תיקונים</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">עלות מצטברת (ללא מע"מ)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">₪{Math.round(totalCost).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">ספקים פעילים</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{new Set(filtered.map(r => r.repair_supplier).filter(Boolean)).size}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> ניהול תיקונים ({filtered.length})</CardTitle>
            <Input dir="rtl" className="max-w-md mt-2 text-right" placeholder="חיפוש כללי בכל העמודות..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={addRow}><Plus className="h-4 w-4 ml-1" /> הוסף תיקון חדש</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="w-full overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="col-actions w-[70px]">פעולות</TableHead>
                    <TableHead className="col-num w-[110px]"><HeaderCell label="באישור" sortKey="is_approved" sort={sort} onSort={toggleSort} filterKind="picks" options={approvers} filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-num w-[120px]"><HeaderCell label='עלות ללא מע"מ (₪)' sortKey="cost_excl_vat" sort={sort} onSort={toggleSort} filterKind="number" filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text min-w-[240px]"><HeaderCell label="מה תיקנו?" sortKey="description" sort={sort} onSort={toggleSort} filterKind="text" filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text w-[150px]"><HeaderCell label="מיקום" sortKey="location_text" sort={sort} onSort={toggleSort} filterKind="text" filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-num w-[110px]"><HeaderCell label="חשבונית" sortKey="invoice_number" sort={sort} onSort={toggleSort} filterKind="text" filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text w-[100px]"><HeaderCell label="ספק" sortKey="repair_supplier" sort={sort} onSort={toggleSort} filterKind="picks" options={suppliers} filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-num w-[100px]"><HeaderCell label="תאריך" sortKey="repair_date" sort={sort} onSort={toggleSort} filterKind="date" filters={filters} setFilters={setFilters} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="col-actions w-[70px]">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="col-num"><EditableSelectCell value={r.is_approved} options={approvers} onSave={v => patch(r, { is_approved: v })} /></TableCell>
                      <TableCell className="col-num"><EditableTextCell type="number" value={r.cost_excl_vat} onSave={v => patch(r, { cost_excl_vat: v })} /></TableCell>
                      <TableCell className="col-text whitespace-normal break-words align-top"><EditableTextCell multiline value={r.description} onSave={v => patch(r, { description: v })} /></TableCell>
                      <TableCell className="col-text"><EditableTextCell value={r.location_text} onSave={v => patch(r, { location_text: v })} /></TableCell>
                      <TableCell className="col-num"><EditableTextCell value={r.invoice_number} onSave={v => patch(r, { invoice_number: v })} /></TableCell>
                      <TableCell className="col-text"><EditableSelectCell value={r.repair_supplier} options={suppliers} onSave={v => patch(r, { repair_supplier: v })} /></TableCell>
                      <TableCell className="col-num"><EditableTextCell type="date" value={r.repair_date} onSave={v => patch(r, { repair_date: v })} /></TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">לא נמצאו תיקונים</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התיקון?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו לא ניתנת לשחזור.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
