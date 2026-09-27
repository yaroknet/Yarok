import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, CheckCircle, MessageCircle, Loader2 } from 'lucide-react';
import yarokLogo from '@/assets/yarok-logo.png';

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
  extra_questions: { text: string }[];
}

const regionManagers = [
  'אייל', 'שמוליק', 'אדם', 'צביה', 'סבטלנה', 'ציפי', 'אורלי', 'צחי', 'עוזי', 'רונית', 'מיטל', 'מיטל איבגי', 'לא יודע/ת'
];

const defaultQuestions = [
  'כיצד היית מדרג/ת את רמת הניקיון במקום בסיום יום העבודה של המנקה?',
  'באיזו מידה המנקה מקפיד/ה על הגעה בזמן ועל עמידה בשעות העבודה שנקבעו?',
  'כיצד היית מדרג/ת את רמת הזמינות והשירותיות של מנהל האזור מטעם חברת הניקיון?',
  'במידה והיו תקלות או בקשות מיוחדות, עד כמה את/ה מרוצה ממהירות ויעילות הטיפול בהן?',
  'חוויה כללית מהשירות',
];

const ratingKeys = ['rating_cleanliness', 'rating_punctuality', 'rating_manager_service', 'rating_issue_handling', 'rating_overall'] as const;

const PublicSurvey = () => {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template') || '';
  const prefillBranch = searchParams.get('branch') || '';
  const prefillChain = searchParams.get('chain') || '';
  const prefillManager = searchParams.get('manager') || '';

  const [template, setTemplate] = useState<SurveyTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(!!templateId);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [averageScore, setAverageScore] = useState(0);

  const [formData, setFormData] = useState({
    chain_name: prefillChain,
    branch_name: prefillBranch,
    manager_name: prefillManager,
    respondent_name: '',
    respondent_role: '',
    customer_phone: '',
    rating_cleanliness: 0,
    rating_punctuality: 0,
    rating_manager_service: 0,
    rating_issue_handling: 0,
    rating_overall: 0,
    free_text: '',
  });
  const [extraRatings, setExtraRatings] = useState<number[]>([]);

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('public_survey_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const t: SurveyTemplate = {
          ...(data as any),
          show_manager_field: (data as any).show_manager_field ?? true,
          show_branch_field: (data as any).show_branch_field ?? true,
          show_role_field: (data as any).show_role_field ?? false,
          extra_questions: Array.isArray((data as any).extra_questions) ? (data as any).extra_questions : [],
        };
        setTemplate(t);
        setExtraRatings(new Array(t.extra_questions.length).fill(0));
      }
    } catch (e) {
      console.error('Error loading template:', e);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const questions = template
    ? [template.question_1, template.question_2, template.question_3, template.question_4, template.question_5]
    : defaultQuestions;

  const surveyTitle = template?.name || 'סקר שביעות רצון';

  const handleRating = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const showManager = template?.show_manager_field ?? true;
    const showBranch = template?.show_branch_field ?? true;
    const showRole = template?.show_role_field ?? false;
    const requiredBase = !formData.chain_name.trim() || !formData.respondent_name.trim() || !formData.customer_phone.trim();
    if (
      requiredBase ||
      (showBranch && !formData.branch_name.trim()) ||
      (showManager && !formData.manager_name.trim()) ||
      (showRole && !formData.respondent_role.trim())
    ) {
      toast.error('נא למלא את כל שדות החובה');
      return;
    }

    const ratings = ratingKeys.map(k => formData[k]);
    if (ratings.some(r => r === 0)) {
      toast.error('נא לדרג את כל השאלות');
      return;
    }
    if (extraRatings.some(r => r === 0)) {
      toast.error('נא לדרג את כל השאלות הנוספות');
      return;
    }

    const phoneRegex = /^0[0-9]{8,9}$/;
    if (!phoneRegex.test(formData.customer_phone.replace(/[-\s]/g, ''))) {
      toast.error('נא להזין מספר טלפון תקין');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('customer_surveys').insert({
        chain_name: formData.chain_name.trim(),
        branch_name: (template?.show_branch_field ?? true) ? formData.branch_name.trim() : '—',
        manager_name: (template?.show_manager_field ?? true) ? formData.manager_name.trim() : '—',
        respondent_name: formData.respondent_name.trim(),
        respondent_role: (template?.show_role_field ?? false) ? (formData.respondent_role.trim() || null) : null,
        customer_phone: formData.customer_phone.trim(),
        rating_cleanliness: formData.rating_cleanliness,
        rating_punctuality: formData.rating_punctuality,
        rating_manager_service: formData.rating_manager_service,
        rating_issue_handling: formData.rating_issue_handling,
        rating_overall: formData.rating_overall,
        free_text: formData.free_text.trim() || null,
        template_id: template?.id || null,
        // assigned_manager_id is resolved server-side from the template
        extra_ratings: (template?.extra_questions || []).map((q, i) => ({ question: q.text, rating: extraRatings[i] })) as any,
      });

      if (error) throw error;

      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      setAverageScore(avg);
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('שגיאה בשליחת הסקר, נא לנסות שוב');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTemplate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">תודה רבה!</h2>
            <p className="text-muted-foreground">המשוב שלך התקבל בהצלחה ויעזור לנו לשפר את השירות.</p>
            {averageScore < 3 && (
              <a
                href={`https://wa.me/972528962561?text=${encodeURIComponent('שלום, מילאתי סקר שביעות רצון ואשמח לשוחח על שיפור השירות.')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full mt-4 gap-2" variant="default">
                  <MessageCircle className="h-5 w-5" />
                  לפנייה דחופה לשירות לקוחות ב-WhatsApp
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <img src={yarokLogo} alt="ירוק לוגו" className="h-16 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{surveyTitle}</h1>
          <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
            לקוח/ה יקר/ה, דעתך חשובה לנו! נשמח אם תקדיש/י דקה למילוי סקר קצר לשיפור השירות.
            התשובות משמשות לשיפור פנימי בלבד.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground">פרטי הלקוח</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!prefillChain && (
                  <div className="space-y-2">
                    <Label htmlFor="chain_name">שם רשת *</Label>
                    <Input id="chain_name" value={formData.chain_name} onChange={e => setFormData(prev => ({ ...prev, chain_name: e.target.value }))} placeholder="שם הרשת" required />
                  </div>
                )}
                {!prefillBranch && (template?.show_branch_field ?? true) && (
                  <div className="space-y-2">
                    <Label htmlFor="branch_name">סניף *</Label>
                    <Input id="branch_name" value={formData.branch_name} onChange={e => setFormData(prev => ({ ...prev, branch_name: e.target.value }))} placeholder="שם הסניף" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="respondent_name">מה שמך? *</Label>
                  <Input id="respondent_name" value={formData.respondent_name} onChange={e => setFormData(prev => ({ ...prev, respondent_name: e.target.value }))} placeholder="שם מלא" required />
                </div>
                {(template?.show_role_field ?? false) && (
                  <div className="space-y-2">
                    <Label htmlFor="respondent_role">תפקיד *</Label>
                    <Input id="respondent_role" value={formData.respondent_role} onChange={e => setFormData(prev => ({ ...prev, respondent_role: e.target.value }))} placeholder="למשל: מנהל/ת סניף" required />
                  </div>
                )}
                {!prefillManager && (template?.show_manager_field ?? true) && (
                  <div className="space-y-2">
                    <Label htmlFor="manager_name">מנהל האזור מטעם ירוק שמספק לך שירות *</Label>
                    <Select value={formData.manager_name || undefined} onValueChange={v => setFormData(prev => ({ ...prev, manager_name: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר/י מנהל אזור" />
                      </SelectTrigger>
                      <SelectContent>
                        {regionManagers.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">טלפון *</Label>
                  <Input id="customer_phone" type="tel" value={formData.customer_phone} onChange={e => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))} placeholder="050-0000000" required dir="ltr" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="p-6 space-y-6">
              <h3 className="text-lg font-semibold text-foreground">דרג/י את השירות</h3>
              {questions.map((q, i) => (
                <div key={i} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{q}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => handleRating(ratingKeys[i], star)} className="p-1 transition-transform hover:scale-110">
                        <Star className={`h-8 w-8 transition-colors ${star <= formData[ratingKeys[i]] ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {(template?.extra_questions || []).map((q, i) => (
                <div key={`extra-${i}`} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{q.text}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => setExtraRatings(prev => prev.map((v, idx) => idx === i ? star : v))} className="p-1 transition-transform hover:scale-110">
                        <Star className={`h-8 w-8 transition-colors ${star <= (extraRatings[i] || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-lg font-semibold text-foreground">הצעות לשיפור</h3>
              <Textarea value={formData.free_text} onChange={e => setFormData(prev => ({ ...prev, free_text: e.target.value }))} placeholder="נשמח לשמוע ממך הצעות, הערות או כל דבר שיכול לעזור לנו להשתפר..." rows={4} maxLength={1000} />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full py-6 text-lg" disabled={submitting}>
            {submitting ? 'שולח...' : 'שליחת הסקר'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PublicSurvey;
