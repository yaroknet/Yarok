import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Filter, Pencil, PhoneCall } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ServiceRequest {
  id: string;
  request_date: string | null;
  location: string | null;
  supplier_name: string | null;
  issue_description: string | null;
  status: 'בטיפול' | 'טופל';
  resolved_at: string | null;
  linked_repair_id: string | null;
}

const DEFAULT_SUPPLIERS = ['סנו', 'רנמ', 'רתמ', 'אלרז', 'מורן', 'זוהר פיקס'];
const STATUSES: Array<ServiceRequest['status']> = ['בטיפול', 'טופל'];

type Sort = { key: keyof ServiceRequest; dir: 'asc' | 'desc' } | null;
type ColFilters = Partial<Record<keyof ServiceRequest, { text?: string; picks?: string[]; from?: string; to?: string }>>;

function EditableTextCell({ value, onSave, type = 'text' }: { value: any; onSave: (v: any) => any; type?: 'text' | 'date' }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<string>(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = async () => {
    const newVal = v === '' ? null : v;
    if ((value ?? '') === (newVal ?? '')) { setEditing(false); return; }
    await onSave(newVal);
    setEditing(false);
  };
  if (!editing) return (
    <div onClick={() => setEditing(true)} className="group cursor-text px-2 py-1 rounded hover:bg-accent/40 min-h-[28px] flex items-center justify-between gap-1" title="לחץ לעריכה">
      <span className="truncate">
        {type === 'date' && value ? new Date(value).toLocaleDateString('he-IL') : (value ?? <span className="text-muted-foreground">—</span>)}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </div>
  );
  return (
    <Input autoFocus type={type === 'date' ? 'date' : 'text'}
      value={v} onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      onBlur={commit} className="h-8" />
  );
}

function HeaderCell({
  label, sortKey, sort, onSort, filterKind, filters, setFilters, options,
}: {
  label: string; sortKey?: keyof ServiceRequest; sort: Sort; onSort: (k: keyof ServiceRequest) => void;
  filterKind?: 'text' | 'picks' | 'date';
  filters: ColFilters; setFilters: (f: ColFilters) => void; options?: string[];
}) {
  const active = !!(sort && sortKey && sort.key === sortKey);
  const cur = sortKey ? filters[sortKey] : undefined;
  const hasFilter = !!(cur && (cur.text || cur.picks?.length || cur.from || cur.to));
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

export default function ServiceRequestsTab() {
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'request_date', dir: 'desc' });
  const [filters, setFilters] = useState<ColFilters>({});
  const [deleting, setDeleting] = useState<ServiceRequest | null>(null);
  const [locations, setLocations] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, machinesRes] = await Promise.all([
      supabase.from('machine_service_requests' as any).select('*').order('request_date', { ascending: false }),
      supabase.from('machines').select('current_location'),
    ]);
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    const locs = new Set<string>();
    (machinesRes.data || []).forEach((m: any) => m.current_location && locs.add(m.current_location));
    ((data as any) || []).forEach((r: ServiceRequest) => r.location && locs.add(r.location));
    setLocations(Array.from(locs).sort());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const suppliers = useMemo(
    () => Array.from(new Set([...DEFAULT_SUPPLIERS, ...rows.map(r => r.supplier_name).filter(Boolean) as string[]])),
    [rows]
  );

  const patch = async (r: ServiceRequest, p: Partial<ServiceRequest>) => {
    // Handle status transition -> create repair row
    if (p.status === 'טופל' && r.status !== 'טופל') {
      const { data: repair, error: repErr } = await supabase.from('machine_repairs').insert({
        repair_supplier: r.supplier_name,
        location_text: r.location,
        equipment_type: 'מכונת שטיפה',
        description: r.issue_description ? `[מקריאת שירות] ${r.issue_description}` : null,
        invoice_number: 'להשלמה',
        is_approved: 'להשלמה',
      } as any).select('id').single();
      if (repErr) return toast.error('שגיאה ביצירת שורת תיקון: ' + repErr.message);
      (p as any).resolved_at = new Date().toISOString();
      (p as any).linked_repair_id = repair.id;
      toast.success('נוצרה שורת תיקון חדשה בטאב "ניהול תיקונים" - להשלמת פרטים');
    }
    const { error } = await supabase.from('machine_service_requests' as any).update(p as any).eq('id', r.id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...p } as ServiceRequest : x));
  };

  const addRow = async () => {
    const { data, error } = await supabase.from('machine_service_requests' as any).insert({
      request_date: new Date().toISOString().slice(0, 10),
      status: 'בטיפול',
    } as any).select('*').single();
    if (error) return toast.error(error.message);
    setRows(prev => [data as any, ...prev]);
    toast.success('נוספה קריאת שירות חדשה');
  };

  const doDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('machine_service_requests' as any).delete().eq('id', deleting.id);
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
      const key = k as keyof ServiceRequest;
      if (cfg?.text) { const t = cfg.text.toLowerCase(); out = out.filter(r => String(r[key] ?? '').toLowerCase().includes(t)); }
      if (cfg?.picks?.length) out = out.filter(r => cfg.picks!.includes(String(r[key] ?? '')));
      if (cfg?.from) out = out.filter(r => r[key] && String(r[key]) >= cfg.from!);
      if (cfg?.to) out = out.filter(r => r[key] && String(r[key]) <= cfg.to!);
    }
    if (sort) {
      out.sort((a, b) => {
        const av: any = a[sort.key] ?? ''; const bv: any = b[sort.key] ?? '';
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv), 'he') : String(bv).localeCompare(String(av), 'he');
      });
    }
    return out;
  }, [rows, search, filters, sort]);

  const toggleSort = (key: keyof ServiceRequest) => {
    setSort(prev => !prev || prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null);
  };

  const openCount = filtered.filter(r => r.status === 'בטיפול').length;
  const resolvedCount = filtered.filter(r => r.status === 'טופל').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">סה"כ קריאות</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">בטיפול</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">טופלו</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-600">{resolvedCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" /> קריאות שירות ({filtered.length})</CardTitle>
            <Input dir="rtl" className="max-w-md mt-2 text-right" placeholder="חיפוש כללי..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={addRow}><Plus className="h-4 w-4 ml-1" /> קריאה חדשה</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="col-actions">פעולות</TableHead>
                    <TableHead className="col-num min-w-[140px]"><HeaderCell label="סטטוס" sortKey="status" sort={sort} onSort={toggleSort} filterKind="picks" options={STATUSES as unknown as string[]} filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text min-w-[280px]"><HeaderCell label="תיאור התקלה" sortKey="issue_description" sort={sort} onSort={toggleSort} filterKind="text" filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text min-w-[130px]"><HeaderCell label="ספק מטפל" sortKey="supplier_name" sort={sort} onSort={toggleSort} filterKind="picks" options={suppliers} filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-text min-w-[180px]"><HeaderCell label="מיקום" sortKey="location" sort={sort} onSort={toggleSort} filterKind="picks" options={locations} filters={filters} setFilters={setFilters} /></TableHead>
                    <TableHead className="col-num min-w-[130px]"><HeaderCell label="תאריך פניה" sortKey="request_date" sort={sort} onSort={toggleSort} filterKind="date" filters={filters} setFilters={setFilters} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="align-middle">
                      <TableCell className="col-actions">
                        <Button size="icon" variant="ghost" title="מחיקה" className="text-destructive" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="col-num">
                        <Select value={r.status} onValueChange={v => patch(r, { status: v as any })}>
                          <SelectTrigger
                            className={`h-8 font-semibold text-white border-0 justify-center ${r.status === 'טופל' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="col-text whitespace-normal max-w-[380px]">
                        <EditableTextCell value={r.issue_description} onSave={v => patch(r, { issue_description: v })} />
                      </TableCell>
                      <TableCell className="col-text">
                        <Select value={r.supplier_name ?? ''} onValueChange={v => patch(r, { supplier_name: v })}>
                          <SelectTrigger className="h-8 border-transparent hover:border-input bg-transparent hover:bg-accent/40">
                            <SelectValue placeholder="בחר ספק" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="col-text">
                        <Select value={r.location ?? ''} onValueChange={v => patch(r, { location: v })}>
                          <SelectTrigger className="h-8 border-transparent hover:border-input bg-transparent hover:bg-accent/40">
                            <SelectValue placeholder="בחר מיקום" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="col-num"><EditableTextCell type="date" value={r.request_date} onSave={v => patch(r, { request_date: v })} /></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">אין קריאות שירות</TableCell></TableRow>
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
            <AlertDialogTitle>למחוק את קריאת השירות?</AlertDialogTitle>
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
