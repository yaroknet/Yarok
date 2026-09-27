import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreatePurchaseRequestDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    quantity: 1,
    justification: '',
    needed_by_date: null as Date | null,
  });

  const handleSubmit = async () => {
    if (!formData.item_name.trim()) {
      toast.error('שם הפריט הוא שדה חובה');
      return;
    }
    if (!formData.justification.trim()) {
      toast.error('נימוק לרכישה הוא שדה חובה');
      return;
    }
    if (!formData.needed_by_date) {
      toast.error('תאריך נדרש הוא שדה חובה');
      return;
    }
    if (!user) {
      toast.error('שגיאה בזיהוי המשתמש');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .insert({
          user_id: user.id,
          item_name: formData.item_name,
          description: formData.description || null,
          quantity: formData.quantity,
          justification: formData.justification,
          needed_by_date: format(formData.needed_by_date, 'yyyy-MM-dd'),
        });

      if (error) throw error;

      toast.success('בקשת הרכש נשלחה בהצלחה');
      setFormData({
        item_name: '',
        description: '',
        quantity: 1,
        justification: '',
        needed_by_date: null,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('שגיאה ביצירת הבקשה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>בקשת רכש חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="item_name">שם הפריט *</Label>
            <Input
              id="item_name"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="לדוגמה: מדפסת לייזר"
            />
          </div>

          <div>
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="פרטים נוספים על הפריט המבוקש..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="quantity">כמות</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div>
            <Label htmlFor="justification">נימוק לרכישה *</Label>
            <Textarea
              id="justification"
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="מדוע נדרש הפריט? מה הצורך העסקי?"
              rows={3}
            />
          </div>

          <div>
            <Label>תאריך נדרש *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right",
                    !formData.needed_by_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {formData.needed_by_date 
                    ? format(formData.needed_by_date, 'dd/MM/yyyy') 
                    : 'בחר תאריך'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.needed_by_date || undefined}
                  onSelect={(date) => setFormData({ ...formData, needed_by_date: date || null })}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'שולח...' : 'שלח בקשה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
