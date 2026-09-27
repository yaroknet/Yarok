import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Star, Send, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Survey {
  id: string;
  survey_period: string;
  sent_at: string;
  status: string;
}

interface SatisfactionSurveyFormProps {
  userId: string;
}

const SatisfactionSurveyForm = ({ userId }: SatisfactionSurveyFormProps) => {
  const [pendingSurvey, setPendingSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(0);
  const [punctualityRating, setPunctualityRating] = useState<number>(0);
  const [managerRating, setManagerRating] = useState<number>(0);
  const [suggestions, setSuggestions] = useState('');
  const [wantsContact, setWantsContact] = useState<boolean | null>(null);

  useEffect(() => {
    fetchPendingSurvey();
  }, [userId]);

  const fetchPendingSurvey = async () => {
    try {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .eq('client_user_id', userId)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setPendingSurvey(data);
    } catch (error) {
      console.error('Error fetching survey:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!pendingSurvey) return;
    
    if (!cleanlinessRating || !punctualityRating || !managerRating) {
      toast.error('יש לדרג את כל השאלות');
      return;
    }

    if (wantsContact === null) {
      toast.error('יש לבחור האם ברצונך שניצור איתך קשר');
      return;
    }

    setSubmitting(true);
    try {
      // Insert response
      const { error: responseError } = await supabase
        .from('satisfaction_responses')
        .insert({
          survey_id: pendingSurvey.id,
          client_user_id: userId,
          cleanliness_rating: cleanlinessRating,
          workers_punctuality_rating: punctualityRating,
          manager_service_rating: managerRating,
          improvement_suggestions: suggestions || null,
          wants_contact: wantsContact,
        });

      if (responseError) throw responseError;

      // Update survey status
      const { error: updateError } = await supabase
        .from('satisfaction_surveys')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', pendingSurvey.id);

      if (updateError) throw updateError;

      toast.success('הסקר נשלח בהצלחה. תודה על המשוב!');
      setPendingSurvey(null);
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('שגיאה בשליחת הסקר');
    } finally {
      setSubmitting(false);
    }
  };

  const RatingStars = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (val: number) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-base">{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star 
              className={`h-8 w-8 ${
                star <= value 
                  ? 'text-yellow-500 fill-yellow-500' 
                  : 'text-muted-foreground'
              }`} 
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 0 ? 'לחץ לדירוג' : `דירוג: ${value}/5`}
      </p>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingSurvey) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <p className="text-muted-foreground">אין סקרים ממתינים למילוי</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">סקר שביעות רצון</CardTitle>
            <CardDescription>
              נא למלא את הסקר לתקופה {pendingSurvey.survey_period}
            </CardDescription>
          </div>
          <Badge variant="secondary">
            <Clock className="h-3 w-3 ml-1" />
            ממתין למילוי
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question 1 */}
        <RatingStars
          value={cleanlinessRating}
          onChange={setCleanlinessRating}
          label="1. עד כמה את/ה מרוצה מרמת הניקיון הכללית במקום?"
        />

        {/* Question 2 */}
        <RatingStars
          value={punctualityRating}
          onChange={setPunctualityRating}
          label="2. האם העובדים מגיעים בזמן ומבצעים את עבודתם לשביעות רצונך?"
        />

        {/* Question 3 */}
        <RatingStars
          value={managerRating}
          onChange={setManagerRating}
          label="3. האם את/ה מרוצה מהשירות שמתקבל ע״י מנהל/ת האזור?"
        />

        {/* Question 4 - Open */}
        <div className="space-y-2">
          <Label className="text-base">
            4. האם יש משהו שברצונך לשנות או לשפר בשירות?
          </Label>
          <Textarea
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            placeholder="כתוב כאן את הערותיך..."
            rows={4}
          />
        </div>

        {/* Question 5 */}
        <div className="space-y-3">
          <Label className="text-base">
            5. האם ברצונך שניצור איתך קשר עקב המשוב?
          </Label>
          <RadioGroup
            value={wantsContact === null ? '' : wantsContact ? 'yes' : 'no'}
            onValueChange={(val) => setWantsContact(val === 'yes')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="yes" id="contact-yes" />
              <Label htmlFor="contact-yes" className="cursor-pointer">כן</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="no" id="contact-no" />
              <Label htmlFor="contact-no" className="cursor-pointer">לא</Label>
            </div>
          </RadioGroup>
        </div>

        <Button 
          onClick={handleSubmit} 
          className="w-full"
          disabled={submitting}
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background ml-2" />
          ) : (
            <Send className="h-4 w-4 ml-2" />
          )}
          שלח סקר
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          הסקר נשלח בתאריך {format(new Date(pendingSurvey.sent_at), 'dd/MM/yyyy', { locale: he })}
        </p>
      </CardContent>
    </Card>
  );
};

export default SatisfactionSurveyForm;