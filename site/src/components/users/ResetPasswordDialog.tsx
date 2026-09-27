import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export const ResetPasswordDialog = ({ open, onOpenChange, userId, userName }: ResetPasswordDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (password.length < 6) {
        throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים');
      }
      if (password !== confirmPassword) {
        throw new Error('הסיסמאות אינן תואמות');
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          action: 'reset_password',
          user_id: userId,
          password: password,
        },
      });

      if (response.error) throw new Error(response.error.message || 'שגיאה באיפוס סיסמה');
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'הסיסמה אופסה בהצלחה!', description: `הסיסמה של ${userName} עודכנה` });
      onOpenChange(false);
      setPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      console.error('Error resetting password:', error);
      toast({ title: 'שגיאה באיפוס סיסמה', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5" />
            איפוס סיסמה
          </DialogTitle>
          <DialogDescription>
            הגדר סיסמה חדשה עבור <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">סיסמה חדשה</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                dir="ltr"
                className="text-left pl-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">אימות סיסמה</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="הזן שוב את הסיסמה"
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מאפס...
                </>
              ) : (
                <>
                  <KeyRound className="ml-2 h-4 w-4" />
                  איפוס סיסמה
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};