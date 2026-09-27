import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Users, User, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const notificationSchema = z.object({
  title: z.string().min(1, 'נדרשת כותרת'),
  body: z.string().min(1, 'נדרש תוכן'),
  type: z.string().default('general'),
  target_type: z.enum(['all', 'single', 'role']),
  target_user_id: z.string().optional(),
  target_role: z.string().optional(),
  is_scheduled: z.boolean().default(false),
  scheduled_at: z.string().optional(),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface User {
  id: string;
  full_name: string;
  email: string | null;
}

interface SendNotificationDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const SendNotificationDialog = ({ trigger, onSuccess }: SendNotificationDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: '',
      body: '',
      type: 'general',
      target_type: 'all',
      is_scheduled: false,
    },
  });

  const targetType = form.watch('target_type');
  const isScheduled = form.watch('is_scheduled');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id')
        .order('full_name');
      
      if (!error && data) {
        setUsers(data.map(p => ({ id: p.user_id, full_name: p.full_name, email: p.email })));
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  const onSubmit = async (data: NotificationFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const notificationData = {
        title: data.title,
        body: data.body,
        type: data.type,
        target_type: data.target_type,
        target_user_id: data.target_type === 'single' ? data.target_user_id : null,
        target_role: data.target_type === 'role' ? data.target_role : null,
        scheduled_at: data.is_scheduled && data.scheduled_at ? data.scheduled_at : null,
        sent_at: !data.is_scheduled ? new Date().toISOString() : null,
        created_by: user.id,
      };

      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) throw error;

      toast.success(data.is_scheduled ? 'ההתראה תוזמנה בהצלחה' : 'ההתראה נשלחה בהצלחה');
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('שגיאה בשליחת ההתראה');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Send className="h-4 w-4 ml-2" />
            שלח התראה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שליחת התראה חדשה</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת</FormLabel>
                  <FormControl>
                    <Input placeholder="כותרת ההתראה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תוכן ההתראה</FormLabel>
                  <FormControl>
                    <Textarea placeholder="תוכן ההודעה..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג התראה</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">כללי</SelectItem>
                      <SelectItem value="task">משימה</SelectItem>
                      <SelectItem value="reminder">תזכורת</SelectItem>
                      <SelectItem value="announcement">הכרזה</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שלח ל</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          כל המשתמשים
                        </div>
                      </SelectItem>
                      <SelectItem value="single">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          משתמש ספציפי
                        </div>
                      </SelectItem>
                      <SelectItem value="role">
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4" />
                          לפי תפקיד
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {targetType === 'single' && (
              <FormField
                control={form.control}
                name="target_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>בחר משתמש</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר משתמש" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name} {u.email && `(${u.email})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {targetType === 'role' && (
              <FormField
                control={form.control}
                name="target_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>בחר תפקיד</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תפקיד" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="driver">נהגים</SelectItem>
                        <SelectItem value="manager">מנהלים</SelectItem>
                        <SelectItem value="super_admin">מנהלי-על</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_scheduled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">תזמון שליחה</FormLabel>
                    <p className="text-sm text-muted-foreground">שלח בזמן מוגדר מראש</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isScheduled && (
              <FormField
                control={form.control}
                name="scheduled_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך ושעת שליחה</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'שולח...' : (isScheduled ? 'תזמן התראה' : 'שלח עכשיו')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
