import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface Proposal {
  id: string;
  proposal_number: string;
  client_name: string;
}

interface DeleteProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  onSuccess: () => void;
}

export function DeleteProposalDialog({ open, onOpenChange, proposal, onSuccess }: DeleteProposalDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete services first
      await supabase
        .from('proposal_services')
        .delete()
        .eq('proposal_id', proposal.id);

      // Delete client forms if any
      await supabase
        .from('proposal_client_forms')
        .delete()
        .eq('proposal_id', proposal.id);

      // Delete the proposal
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposal.id);

      if (error) throw error;

      toast.success('ההצעה נמחקה בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting proposal:', error);
      toast.error('שגיאה במחיקת ההצעה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת הצעת מחיר</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את הצעת מחיר {proposal.proposal_number} של {proposal.client_name}?
            <br />
            <span className="text-destructive font-medium">פעולה זו אינה ניתנת לביטול.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'מוחק...' : 'מחק הצעה'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
