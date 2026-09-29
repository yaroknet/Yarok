import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, WashingMachine, History as HistoryIcon, Plus, Trash2, ArrowUp, ArrowDown, Filter,
  Save, X, Pencil, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RepairsTab from '@/components/machines/RepairsTab';
import ServiceRequestsTab from '@/components/machines/ServiceRequestsTab';
import MachinesNotificationsDialog from '@/components/machines/MachinesNotificationsDialog';
import { Settings } from 'lucide-react';

const STATUSES = ['פעיל', 'מושבת', 'נמכר', 'לא פעיל'];
const SUPPLIER_STATUSES = ['ליסינג', 'בעלות'];
const DEFAULT_SUPPLIERS = ['סנו', 'רנמ', 'רתמ', 'אלרז', 'מורן', 'זוהר פיקס'];
const SUPPLIERS_LS_KEY = 'machines.suppliers.v1';

interface Machine {
  id: string;
  machine_name: string;
  supplier_name: string | null;
  supplier_status: string | null;
  monthly_rental_cost: number | null;
  monthly_client_charge: number | null;
  current_location: string | null;
  current_status: string | null;
  notes: string | null;
}

type Sort = { key: keyof Machine; dir: 'asc' | 'desc' } | null;
type ColFilters = Partial<Record<keyof Machine, { text?: string; picks?: string[] }>>;

// ---------------- EditableCell ----------------
function EditableCell({
  value, type = 'text', onSave,
}: { value: any; type?: 'text' | 'number'; onSave: (v: any) => any }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<string>(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);

  const commit = async () => {
    const newVal = type === 'number' ? (v === '' ? null : Number(v)) : (v === '' ? null : v);
    if ((value ?? '') === (newVal ?? '')) { setEditing(false); return; }
    await onSave(newVal);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="group cursor-text px-2 py-1 rounded hover:bg-accent/40 min-h-[28px] flex items-center justify-between gap-1"
        title="לחץ לעריכה"
      >
        <span>{value ?? <span className="text-muted-foreground">—</span>}{type === 'number' && value != null ? '' : ''}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        type={type === 'number' ? 'number' : 'text'}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={commit}
        className="h-8"
      />
    </div>
  );
}

function EditableSelectCell({
  value, options, onSave, placeholder,
}: { value: string | null; options: string[]; onSave: (v: string) => any; placeholder?: string }) {
  return (
    <Select value={value ?? ''} onValueChange={v => onSave(v)}>
      <SelectTrigger className="h-8 border-transparent hover:border-input bg-transparent hover:bg-accent/40">
        <SelectValue placeholder={placeholder ?? '—'} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ---------------- Column header with sort + filter ----------------
function HeaderCell({
  label, sortable, sortKey, sort, onSort, filterable, filterKind,
  filters, setFilters, options, align,
}: {
  label: string;
  sortable?: boolean;
  sortKey?: keyof Machine;
  sort: Sort;
  onSort: (k: keyof Machine) => void;
  filterable?: boolean;
  filterKind?: 'text' | 'picks';
  filters: ColFilters;
  setFilters: (f: ColFilters) => void;
  options?: string[];
  align?: 'right' | 'center';
}) {
  const active = !!(sort && sortKey && sort.key === sortKey);
  const cur = sortKey ? filters[sortKey] : undefined;
  const hasFilter = !!(cur && ((cur.text && cur.text.length) || (cur.picks && cur.picks.length)));
  const justify = align === 'center' ? 'justify-center' : 'justify-end';
  const textAlign = align === 'center' ? 'text-center' : 'text-right';
  return (
    <div dir="rtl" className={`flex items-center ${justify} gap-1 ${textAlign}`}>

      <button
        type="button"
        className="font-semibold hover:underline text-right"
        onClick={() => sortable && sortKey && onSort(sortKey)}
      >
        {label}
      </button>
      {sortable && active && sort && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      {filterable && sortKey && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className={`h-6 w-6 ${hasFilter ? 'text-primary' : ''}`}>
              <Filter className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 text-right" dir="rtl" align="start">
            {filterKind === 'text' ? (
              <Input
                dir="rtl"
                className="text-right"
                placeholder="סינון..."
                value={cur?.text ?? ''}
                onChange={e => setFilters({ ...filters, [sortKey]: { text: e.target.value } })}
              />
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(options ?? []).map(opt => {
                  const picks = cur?.picks ?? [];
                  const on = picks.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={on}
                        onCheckedChange={c => {
                          const next = c ? [...picks, opt] : picks.filter(x => x !== opt);
                          setFilters({ ...filters, [sortKey]: { picks: next } });
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
            {hasFilter && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => {
                const { [sortKey]: _, ...rest } = filters; setFilters(rest);
              }}>נקה</Button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ---------------- History Dialog ----------------
function HistoryDialog({ machine, open, onClose }: { machine: Machine; open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ event_date: new Date().toISOString().slice(0, 10), event_type: '', from_location: '', to_location: '', notes: '' });

  const load = async () => {
    setLoading(true);
    const [h, r] = await Promise.all([
      supabase.from('machine_history').select('*').eq('machine_id', machine.id).order('event_date', { ascending: false }),
      supabase.from('machine_repairs').select('*').eq('machine_id', machine.id).order('repair_date', { ascending: false }),
    ]);
    setRows(h.data || []);
    setRepairs(r.data || []);
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open, machine.id]);

  const updateRow = async (id: string, patch: any) => {
    const { error } = await supabase.from('machine_history').update(patch).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };
  const deleteRow = async (id: string) => {
    const { error } = await supabase.from('machine_history').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('נמחק'); load();
  };
  const addRow = async () => {
    const { error } = await supabase.from('machine_history').insert({ machine_id: machine.id, ...newRow });
    if (error) return toast.error(error.message);
    setAdding(false);
    setNewRow({ event_date: new Date().toISOString().slice(0, 10), event_type: '', from_location: '', to_location: '', notes: '' });
    toast.success('נוסף'); load();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" /> היסטוריית מכונה — {machine.machine_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-muted-foreground">{rows.length} אירועים</div>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 ml-1" /> אירוע חדש</Button>
        </div>

        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="col-num">תאריך</TableHead>
                <TableHead className="col-text">סוג אירוע</TableHead>
                <TableHead className="col-text">מ־</TableHead>
                <TableHead className="col-text">אל</TableHead>
                <TableHead className="col-text">הערות / השתלשלות עניינים</TableHead>
                <TableHead className="col-actions"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && (
                <TableRow className="bg-accent/30 align-top">
                  <TableCell className="col-num py-2"><Input type="date" value={newRow.event_date} onChange={e => setNewRow({ ...newRow, event_date: e.target.value })} className="h-9" /></TableCell>
                  <TableCell className="col-text py-2"><Input value={newRow.event_type} onChange={e => setNewRow({ ...newRow, event_type: e.target.value })} className="h-9" placeholder="שינוי מיקום / סטטוס / ..." /></TableCell>
                  <TableCell className="col-text py-2"><Input value={newRow.from_location} onChange={e => setNewRow({ ...newRow, from_location: e.target.value })} className="h-9" placeholder="מיקום קודם" /></TableCell>
                  <TableCell className="col-text py-2"><Input value={newRow.to_location} onChange={e => setNewRow({ ...newRow, to_location: e.target.value })} className="h-9" placeholder="מיקום חדש" /></TableCell>
                  <TableCell className="col-text py-2"><Textarea value={newRow.notes} onChange={e => setNewRow({ ...newRow, notes: e.target.value })} className="min-h-[36px] h-9 py-2" placeholder="פרטים" /></TableCell>
                  <TableCell className="col-actions py-2">
                    <div className="flex gap-1 justify-center">
                      <Button size="icon" variant="ghost" onClick={addRow}><Save className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="col-num"><EditableCell value={r.event_date} onSave={v => updateRow(r.id, { event_date: v })} /></TableCell>
                  <TableCell className="col-text"><EditableCell value={r.event_type} onSave={v => updateRow(r.id, { event_type: v })} /></TableCell>
                  <TableCell className="col-text"><EditableCell value={r.from_location} onSave={v => updateRow(r.id, { from_location: v })} /></TableCell>
                  <TableCell className="col-text"><EditableCell value={r.to_location} onSave={v => updateRow(r.id, { to_location: v })} /></TableCell>
                  <TableCell className="col-text"><EditableCell value={r.notes} onSave={v => updateRow(r.id, { notes: v })} /></TableCell>
                  <TableCell className="col-actions">
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRow(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !adding && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">אין אירועים בהיסטוריה</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {repairs.length > 0 && (
          <div className="mt-6">
            <h4 className="font-bold flex items-center gap-2 mb-2"><Wrench className="h-4 w-4" /> תיקונים ({repairs.length})</h4>
            <div className="space-y-2">
              {repairs.map(r => (
                <div key={r.id} className="border-r-4 border-primary/60 pr-3 py-2 bg-muted/30 rounded text-sm">
                  <div className="text-xs text-muted-foreground">
                    {r.repair_date && format(new Date(r.repair_date), 'dd/MM/yyyy')} • {r.repair_supplier || '—'}
                    {r.invoice_number && ` • חשבונית ${r.invoice_number}`}
                    {r.cost_excl_vat && ` • ₪${r.cost_excl_vat}`}
                  </div>
                  <div>{r.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Add Machine Dialog ----------------
function AddMachineDialog({ open, onClose, onSaved, suppliers }: { open: boolean; onClose: () => void; onSaved: () => void; suppliers: string[] }) {
  const [form, setForm] = useState<any>({
    machine_name: '', supplier_name: '', supplier_status: '', current_status: 'פעיל',
    current_location: '', monthly_rental_cost: '', monthly_client_charge: '',
  });
  const save = async () => {
    if (!form.machine_name) return toast.error('שם מכונה חובה');
    const payload = {
      ...form,
      monthly_rental_cost: form.monthly_rental_cost ? Number(form.monthly_rental_cost) : null,
      monthly_client_charge: form.monthly_client_charge ? Number(form.monthly_client_charge) : null,
    };
    const { error } = await supabase.from('machines').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('נוסף'); onSaved(); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>הוסף מכונה חדשה</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>שם המכונה *</Label><Input value={form.machine_name} onChange={e => setForm({ ...form, machine_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>ספק</Label>
              <Select value={form.supplier_name} onValueChange={v => setForm({ ...form, supplier_name: v })}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>סטטוס ספק</Label>
              <Select value={form.supplier_status} onValueChange={v => setForm({ ...form, supplier_status: v })}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{SUPPLIER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>מיקום נוכחי</Label><Input value={form.current_location} onChange={e => setForm({ ...form, current_location: e.target.value })} /></div>
          <div><Label>סטטוס</Label>
            <Select value={form.current_status} onValueChange={v => setForm({ ...form, current_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>עלות חודשית מספק (₪)</Label><Input type="number" value={form.monthly_rental_cost} onChange={e => setForm({ ...form, monthly_rental_cost: e.target.value })} /></div>
            <div><Label>חיוב חודשי ללקוח (₪)</Label><Input type="number" value={form.monthly_client_charge} onChange={e => setForm({ ...form, monthly_client_charge: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={save}>הוסף</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Main Screen ----------------
export default function MachinesManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'machine_name', dir: 'asc' });
  const [filters, setFilters] = useState<ColFilters>({});
  const [historyFor, setHistoryFor] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SUPPLIERS_LS_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      return Array.from(new Set([...DEFAULT_SUPPLIERS, ...stored]));
    } catch { return DEFAULT_SUPPLIERS; }
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('machines').select('*').order('machine_name');
    setMachines(data || []);
    // merge suppliers found in data
    const found = Array.from(new Set((data || []).map(m => m.supplier_name).filter(Boolean) as string[]));
    setSuppliers(prev => Array.from(new Set([...prev, ...found])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addSupplier = () => {
    const name = window.prompt('שם הספק החדש');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed || suppliers.includes(trimmed)) return;
    const next = [...suppliers, trimmed];
    setSuppliers(next);
    try {
      const custom = next.filter(s => !DEFAULT_SUPPLIERS.includes(s));
      localStorage.setItem(SUPPLIERS_LS_KEY, JSON.stringify(custom));
    } catch {}
    toast.success(`נוסף ספק: ${trimmed}`);
  };

  const activeCount = useMemo(() => machines.filter(m => m.current_status === 'פעיל').length, [machines]);

  const patchMachine = async (m: Machine, patch: Partial<Machine>, historyPayload?: Partial<any>) => {
    const { error } = await supabase.from('machines').update(patch).eq('id', m.id);
    if (error) return toast.error(error.message);
    if (historyPayload) {
      await supabase.from('machine_history').insert({
        machine_id: m.id,
        event_date: new Date().toISOString().slice(0, 10),
        event_type: 'עדכון',
        ...historyPayload,
      } as any);
    }
    setMachines(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } as Machine : x));
  };

  const onLocationChange = (m: Machine, val: any) => {
    const from = m.current_location;
    return patchMachine(m, { current_location: val }, {
      event_type: 'שינוי מיקום',
      from_location: from,
      to_location: val,
      notes: `${from ?? '—'} → ${val ?? '—'}`,
    });
  };
  const onStatusChange = (m: Machine, val: any) => {
    const from = m.current_status;
    return patchMachine(m, { current_status: val }, {
      event_type: 'שינוי סטטוס',
      notes: `סטטוס: ${from ?? '—'} → ${val ?? '—'}`,
    });
  };

  const deleteMachine = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('machines').delete().eq('id', deleting.id);
    if (error) return toast.error(error.message);
    toast.success('נמחק'); setDeleting(null); load();
  };

  const filtered = useMemo(() => {
    let out = machines.slice();
    if (search) {
      const s = search.toLowerCase();
      out = out.filter(m =>
        m.machine_name?.toLowerCase().includes(s) ||
        m.current_location?.toLowerCase().includes(s) ||
        m.supplier_name?.toLowerCase().includes(s)
      );
    }
    for (const [k, cfg] of Object.entries(filters)) {
      const key = k as keyof Machine;
      if (cfg?.text) {
        const t = cfg.text.toLowerCase();
        out = out.filter(m => String(m[key] ?? '').toLowerCase().includes(t));
      }
      if (cfg?.picks && cfg.picks.length) {
        out = out.filter(m => cfg.picks!.includes(String(m[key] ?? '')));
      }
    }
    if (sort) {
      out.sort((a, b) => {
        const av = a[sort.key] ?? ''; const bv = b[sort.key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv), 'he') : String(bv).localeCompare(String(av), 'he');
      });
    }
    // Always keep "פעיל" rows at the top
    out.sort((a, b) => {
      const aActive = a.current_status === 'פעיל' ? 0 : 1;
      const bActive = b.current_status === 'פעיל' ? 0 : 1;
      return aActive - bActive;
    });
    return out;
  }, [machines, search, filters, sort]);

  const toggleSort = (key: keyof Machine) => {
    setSort(prev => !prev || prev.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <WashingMachine className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">מעקב מכונות</h1>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} title="נמעני התראות מייל">
            <Settings className="h-4 w-4 ml-1" /> התראות מייל
          </Button>
        </div>

        <Tabs defaultValue="machines" className="space-y-4">
          <TabsList>
            <TabsTrigger value="machines">גיליון ציוד</TabsTrigger>
            <TabsTrigger value="repairs">ניהול תיקונים</TabsTrigger>
            <TabsTrigger value="service">קריאות שירות</TabsTrigger>
          </TabsList>


          <TabsContent value="machines" className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">סה"כ מכונות פעילות</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold text-primary">{activeCount}</div></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">סה"כ מכונות במערכת</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold">{machines.length}</div></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">חיוב חודשי משוער ללקוחות</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold">₪{machines.filter(m=>m.current_status==='פעיל').reduce((s, m) => s + (m.monthly_client_charge || 0), 0).toLocaleString()}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>גיליון ציוד ({filtered.length})</CardTitle>
              <Input dir="rtl" className="max-w-md mt-2 text-right" placeholder="חיפוש כללי..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 ml-1" /> הוסף מכונה חדשה</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div dir="rtl" className="overflow-x-auto border rounded-lg">
                <Table dir="rtl">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right"><HeaderCell label="מיקום נוכחי" sortable sortKey="current_location" sort={sort} onSort={toggleSort} filterable filterKind="text" filters={filters} setFilters={setFilters} /></TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <HeaderCell label="ספק" sortable sortKey="supplier_name" sort={sort} onSort={toggleSort} filterable filterKind="picks" filters={filters} setFilters={setFilters} options={suppliers} />
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="הוסף ספק" onClick={addSupplier}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead className="text-right"><HeaderCell label="סטטוס ספק" sortable sortKey="supplier_status" sort={sort} onSort={toggleSort} filterable filterKind="picks" filters={filters} setFilters={setFilters} options={SUPPLIER_STATUSES} /></TableHead>
                      <TableHead className="text-center"><HeaderCell label="סטטוס" sortable sortKey="current_status" sort={sort} onSort={toggleSort} filterable filterKind="picks" filters={filters} setFilters={setFilters} options={STATUSES} align="center" /></TableHead>
                      <TableHead className="text-center"><HeaderCell label='עלות חודשית מספק (₪)' sortable sortKey="monthly_rental_cost" sort={sort} onSort={toggleSort} filters={filters} setFilters={setFilters} align="center" /></TableHead>
                      <TableHead className="text-center"><HeaderCell label='חיוב חודשי ללקוח (₪)' sortable sortKey="monthly_client_charge" sort={sort} onSort={toggleSort} filters={filters} setFilters={setFilters} align="center" /></TableHead>
                      <TableHead className="text-center">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(m => (
                      <TableRow key={m.id} className="align-middle">
                        <TableCell className="text-right"><EditableCell value={m.current_location} onSave={v => onLocationChange(m, v)} /></TableCell>
                        <TableCell className="text-right"><EditableSelectCell value={m.supplier_name} options={suppliers} onSave={v => patchMachine(m, { supplier_name: v })} /></TableCell>
                        <TableCell className="text-right">
                          <EditableSelectCell value={m.supplier_status} options={SUPPLIER_STATUSES} onSave={v => patchMachine(m, { supplier_status: v })} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                          <Select value={m.current_status ?? ''} onValueChange={v => onStatusChange(m, v)}>
                            <SelectTrigger
                              className={`h-8 w-auto border-0 rounded-full px-3 font-medium justify-center gap-1 [&>svg]:opacity-70 ${
                                m.current_status === 'פעיל' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                                m.current_status === 'לא פעיל' ? 'bg-red-600 text-white hover:bg-red-700' :
                                m.current_status === 'נמכר' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                m.current_status === 'מושבת' ? 'bg-black text-white hover:bg-neutral-800' :
                                'bg-muted text-foreground'
                              }`}
                            >
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-center"><EditableCell type="number" value={m.monthly_rental_cost} onSave={v => patchMachine(m, { monthly_rental_cost: v })} /></TableCell>
                        <TableCell className="text-center"><EditableCell type="number" value={m.monthly_client_charge} onSave={v => patchMachine(m, { monthly_client_charge: v })} /></TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="icon" variant="ghost" title="היסטוריית מכונה" onClick={() => setHistoryFor(m)}>
                              <HistoryIcon className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="מחיקה" className="text-destructive" onClick={() => setDeleting(m)}>
                              <Trash2 className="h-4 w-4 " />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">לא נמצאו מכונות</TableCell></TableRow>
                    )}
                  </TableBody>

                </Table>

              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="repairs">
            <RepairsTab />
          </TabsContent>

          <TabsContent value="service">
            <ServiceRequestsTab />
          </TabsContent>
        </Tabs>

        {historyFor && <HistoryDialog machine={historyFor} open onClose={() => setHistoryFor(null)} />}
        {adding && <AddMachineDialog open onClose={() => setAdding(false)} onSaved={load} suppliers={suppliers} />}
        <MachinesNotificationsDialog open={showSettings} onClose={() => setShowSettings(false)} />

        <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>למחוק את המכונה?</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו תמחק את "{deleting?.machine_name}" יחד עם ההיסטוריה והתיקונים הקשורים.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={deleteMachine} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
