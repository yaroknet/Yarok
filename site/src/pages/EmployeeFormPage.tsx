import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, ExternalLink, Search, CheckCircle2, FileDown, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type FormType = 'form_101' | 'employee_kit' | 'foreign_employee_kit';
type Status = 'office_in_progress' | 'completed';

const FORM_META: Record<FormType, { title: string; settingKey: string }> = {
  form_101: { title: 'טופס 101', settingKey: 'fillout_form_101_url' },
  employee_kit: { title: 'קיט עובד', settingKey: 'fillout_employee_kit_url' },
  foreign_employee_kit: { title: 'קיט עובד זר', settingKey: 'fillout_foreign_employee_kit_url' },
};

interface Submission {
  id: string;
  employee_name: string | null;
  employee_number: string | null;
  identification_number: string | null;
  status: Status;
  received_at: string;
  completed_at: string | null;
  completed_by: string | null;
  fillout_submission_url: string | null;
  fillout_viewer_url: string | null;
  final_pdf_path: string | null;
  final_pdf_url: string | null;
}

const maskId = (id: string | null) => {
  if (!id) return '—';
  const s = String(id);
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
};

export default function EmployeeFormPage() {
  const { formType } = useParams<{ formType: FormType }>();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();

  const meta = formType ? FORM_META[formType] : null;
  const [filloutUrl, setFilloutUrl] = useState<string>('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [completedByMap, setCompletedByMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');

  useEffect(() => {
    if (!formType || !meta) {
      navigate('/payroll', { replace: true });
    }
  }, [formType, meta, navigate]);

  const loadAll = async () => {
    if (!meta || !formType) return;
    setLoading(true);
    try {
      const [{ data: setting }, { data: subs, error }] = await Promise.all([
        supabase.from('system_settings').select('setting_value').eq('setting_key', meta.settingKey).maybeSingle(),
        supabase.from('employee_form_submissions')
          .select('id, employee_name, employee_number, identification_number, status, received_at, completed_at, completed_by, fillout_submission_url, fillout_viewer_url, final_pdf_path, final_pdf_url')
          .eq('form_type', formType)
          .order('received_at', { ascending: false }),
      ]);
      if (error) throw error;
      const raw = setting?.setting_value as any;
      const url = typeof raw === 'string' ? raw : (raw?.value ?? '');
      setFilloutUrl(url || '');
      setUrlDraft(url || '');
      const list = (subs || []) as Submission[];
      setSubmissions(list);

      const ids = Array.from(new Set(list.map(s => s.completed_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
        setCompletedByMap(map);
      } else {
        setCompletedByMap({});
      }
    } catch (e: any) {
      toast.error('שגיאה בטעינה: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [formType]);

  const handleCopyLink = async () => {
    if (!filloutUrl) return;
    try {
      await navigator.clipboard.writeText(filloutUrl);
      toast.success('הקישור הועתק בהצלחה');
    } catch {
      toast.error('לא ניתן להעתיק את הקישור');
    }
  };

  const saveUrl = async () => {
    if (!meta) return;
    try {
      const { error } = await supabase.from('system_settings').upsert({
        setting_key: meta.settingKey,
        setting_value: urlDraft as any,
      }, { onConflict: 'setting_key' });
      if (error) throw error;
      setFilloutUrl(urlDraft);
      setEditingUrl(false);
      toast.success('הקישור נשמר');
    } catch (e: any) {
      toast.error('שגיאה בשמירה: ' + (e?.message ?? ''));
    }
  };

  const markCompleted = async (sub: Submission) => {
    try {
      const { error } = await supabase.from('employee_form_submissions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id ?? null,
      }).eq('id', sub.id);
      if (error) throw error;
      toast.success('הטופס סומן כהושלם');
      loadAll();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const openSignedPdf = async (sub: Submission, download = false) => {
    // Prefer external URL if provided (e.g. Google Drive in the future)
    if (sub.final_pdf_url) {
      window.open(sub.final_pdf_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!sub.final_pdf_path) {
      toast.error('לא נמצא קובץ PDF');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('employee-documents')
        .createSignedUrl(sub.final_pdf_path, 300, download ? { download: true } : undefined);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error('שגיאה בפתיחת הקובץ: ' + (e?.message ?? ''));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (s.employee_name || '').toLowerCase().includes(q)
        || (s.employee_number || '').toLowerCase().includes(q);
    });
  }, [submissions, search, statusFilter]);

  const stats = useMemo(() => ({
    in_progress: submissions.filter(s => s.status === 'office_in_progress').length,
    completed: submissions.filter(s => s.status === 'completed').length,
  }), [submissions]);

  if (!meta) return null;

  return (
    <div dir="rtl" className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payroll"><ArrowRight className="h-4 w-4 ml-1" />חזרה לניהול עובדים</Link>
        </Button>
        <h1 className="text-2xl font-bold flex-1">{meta.title}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">בטיפול המשרד</div>
            <div className="text-3xl font-bold mt-1">{stats.in_progress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">הושלמו</div>
            <div className="text-3xl font-bold mt-1 text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Fillout link section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">קישור לטופס — {meta.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editingUrl ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                dir="ltr"
                placeholder="https://forms.fillout.com/..."
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={saveUrl}>שמירה</Button>
                <Button variant="outline" onClick={() => { setEditingUrl(false); setUrlDraft(filloutUrl); }}>ביטול</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2 text-sm break-all" dir="ltr">
                {filloutUrl || <span className="text-muted-foreground">לא הוגדר קישור עדיין</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopyLink} disabled={!filloutUrl}>
                  <Copy className="h-4 w-4 ml-1" /> העתקת קישור
                </Button>
                <Button variant="outline" asChild disabled={!filloutUrl}>
                  <a href={filloutUrl || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 ml-1" /> פתיחת הטופס
                  </a>
                </Button>
                {isSuperAdmin && (
                  <Button variant="ghost" onClick={() => setEditingUrl(true)}>
                    עריכה
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Submissions table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-lg">טפסים שהתקבלו</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם או מספר עובד"
                  className="pr-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="office_in_progress">בטיפול המשרד</SelectItem>
                  <SelectItem value="completed">הושלם</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              הנתונים יופיעו לאחר חיבור האוטומציה
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">לא נמצאו תוצאות</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם העובד</TableHead>
                    <TableHead className="text-right">מספר עובד</TableHead>
                    <TableHead className="text-right">מספר זיהוי</TableHead>
                    <TableHead className="text-right">תאריך קבלה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">טופל על ידי</TableHead>
                    <TableHead className="text-right">תאריך השלמה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const isDone = s.status === 'completed';
                    const openUrl = s.fillout_submission_url || s.fillout_viewer_url || '';
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.employee_name || '—'}</TableCell>
                        <TableCell>{s.employee_number || '—'}</TableCell>
                        <TableCell dir="ltr" className="text-right font-mono">{maskId(s.identification_number)}</TableCell>
                        <TableCell>{fmtDate(s.received_at)}</TableCell>
                        <TableCell>
                          {isDone ? (
                            <Badge className="bg-green-600 hover:bg-green-600">הושלם</Badge>
                          ) : (
                            <Badge variant="secondary">בטיפול המשרד</Badge>
                          )}
                        </TableCell>
                        <TableCell>{s.completed_by ? (completedByMap[s.completed_by] || '—') : '—'}</TableCell>
                        <TableCell>{fmtDate(s.completed_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isDone ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openSignedPdf(s, false)}>
                                  <Eye className="h-4 w-4 ml-1" /> צפייה ב-PDF
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openSignedPdf(s, true)}>
                                  <FileDown className="h-4 w-4 ml-1" /> הורדה
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" asChild disabled={!openUrl}>
                                  <a href={openUrl || '#'} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 ml-1" /> פתיחה והשלמה
                                  </a>
                                </Button>
                                {s.fillout_viewer_url && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={s.fillout_viewer_url} target="_blank" rel="noopener noreferrer">
                                      <Eye className="h-4 w-4 ml-1" /> צפייה בטופס
                                    </a>
                                  </Button>
                                )}
                                <Button size="sm" variant="secondary" onClick={() => markCompleted(s)}>
                                  <CheckCircle2 className="h-4 w-4 ml-1" /> סימון כהושלם
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
