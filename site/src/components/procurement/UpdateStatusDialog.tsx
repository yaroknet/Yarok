import { useState } from 'react';
import { CheckCircle, XCircle, Truck, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PurchaseRequest {
  id: string;
  status: string;
  rejection_reason: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PurchaseRequest;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'ממתין', icon: Clock, color: 'text-yellow-500' },
  { value: 'approved', label: 'מאושר', icon: CheckCircle, color: 'text-green-500' },
  { value: 'rejected', label: 'נדחה', icon: XCircle, color: 'text-destructive' },
  { value: 'ordered', label: 'הוזמן', icon: Truck, color: 'text-blue-500' },
  { value: 'completed', label: 'הושלם', icon: Package, color: 'text-emerald-600' },
];

export const UpdateStatusDialog = ({ open, onOpenChange, request, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(request.status);
  const [rejectionReason, setRejectionReason] = useState(request.rejection_reason || '');

  const handleSubmit = async () => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      toast.error('יש לציין סיבת דחייה');
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, any> = { status };
      
      if (status === 'rejected') {
        updateData.rejection_reason = rejectionReason;
      } else {
        updateData.rejection_reason = null;
      }

      const { error } = await supabase
        .from('purchase_requests')
        .update(updateData)
        .eq('id', request.id);

      if (error) throw error;

      toast.success('הסטטוס עודכן בהצלחה');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('שגיאה בעדכון הסטטוס');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עדכון סטטוס בקשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-3 block">בחר סטטוס</Label>
            <RadioGroup value={status} onValueChange={setStatus} className="space-y-2">
              {STATUS_OPTIONS.map(option => {
                const Icon = option.icon;
                return (
                  <div 
                    key={option.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      status === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setStatus(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Icon className={`h-5 w-5 ${option.color}`} />
                    <Label htmlFor={option.value} className="cursor-pointer flex-1">
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {status === 'rejected' && (
            <div>
              <Label htmlFor="rejection_reason">סיבת הדחייה *</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="נא לפרט את הסיבה לדחיית הבקשה..."
                rows={3}
                className="border-destructive/50"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'מעדכן...' : 'עדכן סטטוס'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
