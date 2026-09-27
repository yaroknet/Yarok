import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  BarChart3, Users, Star, TrendingUp, Clock, MessageSquare, Phone,
  Search, Copy, ExternalLink, Plus, Settings, Pencil, Trash2, Eye, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ExtraQuestion {
  text: string;
}

interface SurveyTemplate {
  id: string;
  name: string;
  description: string | null;
  question_1: string;
  question_2: string;
  question_3: string;
  question_4: string;
  question_5: string;
  assigned_manager_id: string | null;
  is_active: boolean;
  show_manager_field: boolean;
  show_branch_field: boolean;
  show_role_field: boolean;
  extra_questions: ExtraQuestion[];
  created_at: string;
}

interface CustomerSurvey {
  id: string;
  chain_name: string;
  branch_name: string;
  manager_name: string;
  respondent_name: string | null;
  customer_phone: string;
  rating_cleanliness: number;
  rating_punctuality: number;
  rating_manager_service: number;
  rating_issue_handling: number;
  rating_overall: number;
  free_text: string | null;
  created_at: string;
  template_id: string | null;
  assigned_manager_id: string | null;
  extra_ratings?: { question: string; rating: number }[];
}

interface ManagerProfile {
  user_id: string;
  full_name: string;
}

const emptyTemplate: Omit<SurveyTemplate, 'id' | 'created_at'> = {
  name: '',
  description: '',
  question_1: 'כיצד היית מדרג/ת את רמת הניקיון במקום בסיום יום העבודה של המנקה?',
  question_2: 'באיזו מידה המנקה מקפיד/ה על הגעה בזמן ועל עמידה בשעות העבודה שנקבעו?',
  question_3: 'כיצד היית מדרג/ת את רמת הזמינות והשירותיות של מנהל האזור מטעם חברת הניקיון?',
  question_4: 'במידה והיו תקלות או בקשות מיוחדות, עד כמה את/ה מרוצה ממהירות ויעילות הטיפול בהן?',
  question_5: 'חוויה כללית מהשירות',
  assigned_manager_id: null,
  is_active: true,
  show_manager_field: true,
  show_branch_field: true,
  show_role_field: false,
  extra_questions: [],
};


const regionManagers = [
  'אייל', 'שמוליק', 'אדם', 'צביה', 'סבטלנה', 'ציפי', 'אורלי', 'צחי', 'עוזי', 'רונית', 'מיטל', 'מיטל איבגי', 'לא יודע/ת'
];

const SatisfactionSurveyManagement = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [surveys, setSurveys] = useState<CustomerSurvey[]>([]);
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [filterChain, setFilterChain] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // View survey dialog
  const [viewSurvey, setViewSurvey] = useState<CustomerSurvey | null>(null);

  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [templatesRes, surveysRes, managersRes] = await Promise.all([
        supabase.from('survey_templates').select('*').order('created_at', { ascending: true }),
        supabase.from('customer_surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (surveysRes.error) throw surveysRes.error;

      setTemplates(((templatesRes.data || []) as any[]).map(t => ({
        ...t,
        show_manager_field: t.show_manager_field ?? true,
        show_branch_field: t.show_branch_field ?? true,
        show_role_field: t.show_role_field ?? false,
        extra_questions: Array.isArray(t.extra_questions) ? t.extra_questions : [],
      })) as SurveyTemplate[]);
      setSurveys(((surveysRes.data || []) as any[]).map(s => ({
        ...s,
        extra_ratings: Array.isArray(s.extra_ratings) ? s.extra_ratings : [],
      })) as CustomerSurvey[]);
      setManagers(managersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  // Filtered surveys
  const filtered = surveys.filter(s => {
    if (selectedTemplateId !== 'all' && s.template_id !== selectedTemplateId) return false;
    if (filterChain !== 'all' && s.chain_name !== filterChain) return false;
    if (filterBranch !== 'all' && s.branch_name !== filterBranch) return false;
    if (filterManager !== 'all' && s.assigned_manager_id !== filterManager) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!s.chain_name.toLowerCase().includes(term) && !s.branch_name.toLowerCase().includes(term) && !s.manager_name.toLowerCase().includes(term) && !s.customer_phone.includes(term)) return false;
    }
    return true;
  });

  const uniqueChains = [...new Set(filtered.map(s => s.chain_name))].sort();
  const uniqueBranches = [...new Set(filtered.map(s => s.branch_name))].sort();

  // Stats helper
  const calcAvg = (key: keyof CustomerSurvey) =>
    filtered.length > 0
      ? (filtered.reduce((sum, s) => sum + (s[key] as number), 0) / filtered.length).toFixed(1)
      : '0';

  const avgCleanliness = calcAvg('rating_cleanliness');
  const avgPunctuality = calcAvg('rating_punctuality');
  const avgManagerService = calcAvg('rating_manager_service');
  const avgIssueHandling = calcAvg('rating_issue_handling');
  const avgOverall = calcAvg('rating_overall');
  const totalOverallAvg = filtered.length > 0
    ? ((parseFloat(avgCleanliness) + parseFloat(avgPunctuality) + parseFloat(avgManagerService) + parseFloat(avgIssueHandling) + parseFloat(avgOverall)) / 5).toFixed(1)
    : '0';

  const getManagerName = (id: string | null) => {
    if (!id) return 'לא שויך';
    return managers.find(m => m.user_id === id)?.full_name || 'לא ידוע';
  };

  // Template CRUD
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ ...emptyTemplate });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: SurveyTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      description: t.description || '',
      question_1: t.question_1,
      question_2: t.question_2,
      question_3: t.question_3,
      question_4: t.question_4,
      question_5: t.question_5,
      assigned_manager_id: t.assigned_manager_id,
      is_active: t.is_active,
      show_manager_field: t.show_manager_field ?? true,
      show_branch_field: t.show_branch_field ?? true,
      show_role_field: t.show_role_field ?? false,
      extra_questions: t.extra_questions || [],
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      toast.error('נא להזין שם לסקר');
      return;
    }
    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('survey_templates')
          .update({
            name: templateForm.name,
            description: templateForm.description || null,
            question_1: templateForm.question_1,
            question_2: templateForm.question_2,
            question_3: templateForm.question_3,
            question_4: templateForm.question_4,
            question_5: templateForm.question_5,
            assigned_manager_id: templateForm.assigned_manager_id || null,
            is_active: templateForm.is_active,
            show_manager_field: templateForm.show_manager_field,
            show_branch_field: templateForm.show_branch_field,
            show_role_field: templateForm.show_role_field,
            extra_questions: templateForm.extra_questions.filter(q => q.text.trim()) as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('הסקר עודכן בהצלחה');
      } else {
        const { error } = await supabase
          .from('survey_templates')
          .insert({
            name: templateForm.name,
            description: templateForm.description || null,
            question_1: templateForm.question_1,
            question_2: templateForm.question_2,
            question_3: templateForm.question_3,
            question_4: templateForm.question_4,
            question_5: templateForm.question_5,
            assigned_manager_id: templateForm.assigned_manager_id || null,
            is_active: templateForm.is_active,
            show_manager_field: templateForm.show_manager_field,
            show_branch_field: templateForm.show_branch_field,
            show_role_field: templateForm.show_role_field,
            extra_questions: templateForm.extra_questions.filter(q => q.text.trim()) as any,
            created_by: user?.id,
          });
        if (error) throw error;
        toast.success('הסקר נוצר בהצלחה');
      }
      setTemplateDialogOpen(false);
      fetchAll();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('האם למחוק סקר זה?')) return;
    try {
      const { error } = await supabase.from('survey_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('הסקר נמחק');
      fetchAll();
    } catch (error) {
      toast.error('שגיאה במחיקה');
    }
  };

  const handleAssignManager = async (surveyId: string, managerId: string | null) => {
    try {
      const { error } = await supabase
        .from('customer_surveys')
        .update({ assigned_manager_id: managerId })
        .eq('id', surveyId);
      if (error) throw error;
      setSurveys(prev => prev.map(s => s.id === surveyId ? { ...s, assigned_manager_id: managerId } : s));
      toast.success('מנהל אזור עודכן');
    } catch (error) {
      console.error('Error assigning manager:', error);
      toast.error('שגיאה בשיוך מנהל');
    }
  };

  const handleUpdateSurveyField = async (surveyId: string, field: 'chain_name' | 'manager_name', value: string) => {
    try {
      const { error } = await supabase
        .from('customer_surveys')
        .update({ [field]: value })
        .eq('id', surveyId);
      if (error) throw error;
      setSurveys(prev => prev.map(s => s.id === surveyId ? { ...s, [field]: value } : s));
      toast.success(field === 'chain_name' ? 'שם הרשת עודכן' : 'שם מנהל האזור עודכן');
    } catch (error) {
      console.error('Error updating survey:', error);
      toast.error('שגיאה בעדכון');
    }
    setEditingCell(null);
  };

  const copySurveyLink = (templateId: string) => {
    const url = `${window.location.origin}/survey?template=${templateId}`;
    navigator.clipboard.writeText(url);
    toast.success('הקישור הועתק');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[-\s]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone;
    const message = encodeURIComponent('שלום, תודה שמילאת את סקר שביעות הרצון שלנו. נשמח לשמוע ממך עוד.');
    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank');
  };

  const handleExportExcel = () => {
    if (!filtered.length) {
      toast.error('אין נתונים לייצוא');
      return;
    }
    const rows = filtered.map(s => ({
      'רשת': s.chain_name,
      'סניף': s.branch_name,
      'מנהל חנות': s.respondent_name || '',
      'מנהל אזור': s.manager_name,
      'טלפון': s.customer_phone,
      'ניקיון': s.rating_cleanliness,
      'דייקנות': s.rating_punctuality,
      'שירות מנהל': s.rating_manager_service,
      'תקלות': s.rating_issue_handling,
      'כללי': s.rating_overall,
      'ממוצע': ((s.rating_cleanliness + s.rating_punctuality + s.rating_manager_service + s.rating_issue_handling + s.rating_overall) / 5).toFixed(1),
      'הערות / הצעות לשיפור': s.free_text || '',
      'תאריך': format(new Date(s.created_at), 'dd/MM/yyyy', { locale: he }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Set RTL and column widths
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 40 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'סקרים');
    XLSX.writeFile(wb, `סקרי_שביעות_רצון_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('הקובץ יוצא בהצלחה');
  };

  const renderRatingStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star key={star} className={`h-4 w-4 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/20'}`} />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">סקרי שביעות רצון</h1>
          <p className="text-muted-foreground">ניהול סקרים, תבניות ומעקב אחר תוצאות</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            ייצוא לאקסל
          </Button>
          <Button onClick={openNewTemplate} className="gap-2">
            <Plus className="h-4 w-4" />
            יצירת סקר חדש
          </Button>
        </div>
      </div>

      {/* Templates Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {templates.map(t => {
          const tSurveys = surveys.filter(s => s.template_id === t.id);
          const tAvg = tSurveys.length > 0
            ? ((tSurveys.reduce((sum, s) => sum + s.rating_cleanliness + s.rating_punctuality + s.rating_manager_service + s.rating_issue_handling + s.rating_overall, 0) / (tSurveys.length * 5))).toFixed(1)
            : '0';
          return (
            <Card key={t.id} className={`cursor-pointer transition-all border-2 ${selectedTemplateId === t.id ? 'border-primary' : 'border-transparent hover:border-primary/30'}`}
              onClick={() => setSelectedTemplateId(selectedTemplateId === t.id ? 'all' : t.id)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{tSurveys.length} תשובות</span>
                      <span>ממוצע: {tAvg}/5</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mr-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copySurveyLink(t.id)} title="העתק קישור">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTemplate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-9" />
        </div>
        <Select value={filterChain} onValueChange={setFilterChain}>
          <SelectTrigger><SelectValue placeholder="כל הרשתות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הרשתות</SelectItem>
            {uniqueChains.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger><SelectValue placeholder="כל הסניפים" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסניפים</SelectItem>
            {uniqueBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterManager} onValueChange={setFilterManager}>
          <SelectTrigger><SelectValue placeholder="כל מנהלי האזור" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל מנהלי האזור</SelectItem>
            {managers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ציון כללי</p>
            <p className="text-2xl font-bold text-primary">{totalOverallAvg}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ניקיון</p>
            <p className="text-2xl font-bold">{avgCleanliness}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">דייקנות</p>
            <p className="text-2xl font-bold">{avgPunctuality}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">שירות מנהל</p>
            <p className="text-2xl font-bold">{avgManagerService}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">טיפול בתקלות</p>
            <p className="text-2xl font-bold">{avgIssueHandling}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">סה״כ תשובות</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
          <TabsTrigger value="responses">תשובות ({filtered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">התפלגות ציונים</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {[
                  { label: 'ניקיון', avg: avgCleanliness, color: 'bg-blue-500' },
                  { label: 'דייקנות עובדים', avg: avgPunctuality, color: 'bg-green-500' },
                  { label: 'שירות מנהל/ת', avg: avgManagerService, color: 'bg-purple-500' },
                  { label: 'טיפול בתקלות', avg: avgIssueHandling, color: 'bg-amber-500' },
                  { label: 'חוויה כללית', avg: avgOverall, color: 'bg-primary' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-sm font-medium">{item.avg}/5</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} transition-all rounded-full`} style={{ width: `${(parseFloat(item.avg) / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  הצעות לשיפור אחרונות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {filtered.filter(s => s.free_text).slice(0, 10).map(s => (
                    <div key={s.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium">{s.chain_name} - {s.branch_name}</p>
                        <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yy', { locale: he })}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{s.free_text}</p>
                    </div>
                  ))}
                  {filtered.filter(s => s.free_text).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">אין הצעות לשיפור</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="responses">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>רשת</TableHead>
                      <TableHead>סניף</TableHead>
                      <TableHead>מנהל חנות</TableHead>
                      <TableHead>מנהל אזור</TableHead>
                      <TableHead>ניקיון</TableHead>
                      <TableHead>דייקנות</TableHead>
                      <TableHead>שירות מנהל</TableHead>
                      <TableHead>תקלות</TableHead>
                      <TableHead>כללי</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>פרטים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {editingCell?.id === s.id && editingCell?.field === 'chain_name' ? (
                            <Input
                              autoFocus
                              className="h-8 w-[140px] text-xs"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => handleUpdateSurveyField(s.id, 'chain_name', editValue)}
                              onKeyDown={e => { if (e.key === 'Enter') handleUpdateSurveyField(s.id, 'chain_name', editValue); if (e.key === 'Escape') setEditingCell(null); }}
                            />
                          ) : (
                            <span className="cursor-pointer hover:underline" onClick={() => { setEditingCell({ id: s.id, field: 'chain_name' }); setEditValue(s.chain_name); }}>{s.chain_name}</span>
                          )}
                        </TableCell>
                        <TableCell>{s.branch_name}</TableCell>
                        <TableCell>{s.respondent_name || '-'}</TableCell>
                        <TableCell>
                          {editingCell?.id === s.id && editingCell?.field === 'manager_name' ? (
                            <Select value={editValue} onValueChange={v => handleUpdateSurveyField(s.id, 'manager_name', v)}>
                              <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue placeholder="בחר מנהל אזור" />
                              </SelectTrigger>
                              <SelectContent>
                                {regionManagers.map(name => (
                                  <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="cursor-pointer hover:underline" onClick={() => { setEditingCell({ id: s.id, field: 'manager_name' }); setEditValue(s.manager_name); }}>{s.manager_name}</span>
                          )}
                        </TableCell>
                        <TableCell>{renderRatingStars(s.rating_cleanliness)}</TableCell>
                        <TableCell>{renderRatingStars(s.rating_punctuality)}</TableCell>
                        <TableCell>{renderRatingStars(s.rating_manager_service)}</TableCell>
                        <TableCell>{renderRatingStars(s.rating_issue_handling)}</TableCell>
                        <TableCell>{renderRatingStars(s.rating_overall)}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), 'dd/MM/yy', { locale: he })}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openWhatsApp(s.customer_phone)} title={s.customer_phone}>
                            <Phone className="h-4 w-4 text-green-600" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setViewSurvey(s)} title="צפייה בטופס מלא">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">אין תשובות להצגה</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Survey Dialog */}
      <Dialog open={!!viewSurvey} onOpenChange={(open) => !open && setViewSurvey(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי סקר מלאים</DialogTitle>
          </DialogHeader>
          {viewSurvey && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">רשת:</span>
                  <p className="font-medium">{viewSurvey.chain_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">סניף:</span>
                  <p className="font-medium">{viewSurvey.branch_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">מנהל חנות:</span>
                  <p className="font-medium">{viewSurvey.respondent_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">מנהל אזור:</span>
                  <p className="font-medium">{viewSurvey.manager_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">טלפון:</span>
                  <p className="font-medium">{viewSurvey.customer_phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">תאריך:</span>
                  <p className="font-medium">{format(new Date(viewSurvey.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-foreground">ציונים</h4>
                {[
                  { label: 'ניקיון', value: viewSurvey.rating_cleanliness },
                  { label: 'דייקנות עובדים', value: viewSurvey.rating_punctuality },
                  { label: 'שירות מנהל/ת אזור', value: viewSurvey.rating_manager_service },
                  { label: 'טיפול בתקלות', value: viewSurvey.rating_issue_handling },
                  { label: 'חוויה כללית', value: viewSurvey.rating_overall },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-sm">{item.label}</span>
                    <div className="flex items-center gap-2">
                      {renderRatingStars(item.value)}
                      <span className="text-sm font-medium w-6 text-left">{item.value}/5</span>
                    </div>
                  </div>
                ))}
              </div>

              {viewSurvey.free_text && (
                <div className="border rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    הצעות לשיפור
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewSurvey.free_text}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Template Create/Edit Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'עריכת סקר' : 'יצירת סקר חדש'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם הסקר *</Label>
                <Input value={templateForm.name} onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="למשל: סקר שביעות רצון למנהלי חנויות" />
              </div>
              <div /> {/* placeholder for grid alignment */}
            </div>

            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea value={templateForm.description || ''} onChange={e => setTemplateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="תיאור קצר של הסקר" rows={2} />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-foreground">שאלות דירוג (1-5)</h4>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">שאלה {i}</Label>
                  <Input
                    value={(templateForm as any)[`question_${i}`]}
                    onChange={e => setTemplateForm(prev => ({ ...prev, [`question_${i}`]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">שאלות נוספות (דירוג 1-5)</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => setTemplateForm(prev => ({ ...prev, extra_questions: [...prev.extra_questions, { text: '' }] }))}>
                  <Plus className="h-3.5 w-3.5 ml-1" /> הוסף שאלה
                </Button>
              </div>
              {templateForm.extra_questions.length === 0 && (
                <p className="text-xs text-muted-foreground">אין שאלות נוספות. לחץ "הוסף שאלה" כדי להוסיף.</p>
              )}
              {templateForm.extra_questions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Input
                    value={q.text}
                    placeholder={`שאלה נוספת ${idx + 1}`}
                    onChange={e => setTemplateForm(prev => ({
                      ...prev,
                      extra_questions: prev.extra_questions.map((eq, i) => i === idx ? { ...eq, text: e.target.value } : eq),
                    }))}
                  />
                  <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0"
                    onClick={() => setTemplateForm(prev => ({ ...prev, extra_questions: prev.extra_questions.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch checked={templateForm.show_manager_field} onCheckedChange={v => setTemplateForm(prev => ({ ...prev, show_manager_field: v }))} />
                <Label>הצג שדה "מנהל אזור" בסקר</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={templateForm.show_branch_field} onCheckedChange={v => setTemplateForm(prev => ({ ...prev, show_branch_field: v }))} />
                <Label>הצג שדה "סניף" בסקר</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={templateForm.show_role_field} onCheckedChange={v => setTemplateForm(prev => ({ ...prev, show_role_field: v }))} />
                <Label>הצג שדה "תפקיד" בסקר</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={templateForm.is_active} onCheckedChange={v => setTemplateForm(prev => ({ ...prev, is_active: v }))} />
                <Label>סקר פעיל</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? 'שומר...' : editingTemplate ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SatisfactionSurveyManagement;
