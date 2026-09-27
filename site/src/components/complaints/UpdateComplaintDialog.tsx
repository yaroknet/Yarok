import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Complaint {
  id: string;
  customer_name: string;
  customer_phone: string;
  branch_name: string;
  city: string;
  manager_id: string;
  manager_name: string;
  complaint_description: string;
  resolution_details: string | null;
  status: 'open' | 'in_progress' | 'closed';
  incident_date: string;
  created_at: string;
  notes: string | null;
  history_log: any[];
  created_by: string;
  customerComplaintCount: number;
  managerComplaintCount: number;
}

interface UpdateComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: Complaint;
  onSuccess: () => void;
}

export function UpdateComplaintDialog({ open, onOpenChange, complaint, onSuccess }: UpdateComplaintDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(complaint.status);
  const [resolutionDetails, setResolutionDetails] = useState(complaint.resolution_details || '');
  const [notes, setNotes] = useState(complaint.notes || '');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'פתוח';
      case 'in_progress': return 'בטיפול';
      case 'closed': return 'סגור';
      default: return status;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    if (status === 'closed' && !resolutionDetails.trim()) {
      toast.error('נא להזין פרטי טיפול בעת סגירת תלונה');
      return;
    }

    setLoading(true);
    try {
      const newHistoryEntry = {
        action: 'status_updated',
        timestamp: new Date().toISOString(),
        user_id: user.id,
        details: `סטטוס עודכן ל${getStatusLabel(status)}`
      };

      const updatedHistoryLog = [...(complaint.history_log || []), newHistoryEntry];

      const { error } = await supabase
        .from('complaints')
        .update({
          status,
          resolution_details: resolutionDetails || null,
          notes: notes || null,
          history_log: updatedHistoryLog
        })
        .eq('id', complaint.id);

      if (error) throw error;

      toast.success('התלונה עודכנה בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating complaint:', error);
      toast.error('שגיאה בעדכון התלונה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>עדכון תלונה</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">לקוח: <strong>{complaint.customer_name}</strong></p>
            <p className="text-sm text-muted-foreground mt-1">תיאור: {complaint.complaint_description.slice(0, 100)}...</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">סטטוס</Label>
            <Select value={status} onValueChange={(value: 'open' | 'in_progress' | 'closed') => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">פתוח</SelectItem>
                <SelectItem value="in_progress">בטיפול</SelectItem>
                <SelectItem value="closed">סגור</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="resolution_details">
              פרטי טיפול {status === 'closed' && '*'}
            </Label>
            <Textarea
              id="resolution_details"
              value={resolutionDetails}
              onChange={(e) => setResolutionDetails(e.target.value)}
              placeholder="תאר את אופן הטיפול בתלונה"
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">הערות פנימיות</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות לשימוש פנימי"
              rows={2}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'שומר...' : 'עדכן'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
