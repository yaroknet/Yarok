import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardPlus } from 'lucide-react';
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
import { useManagerTasks } from '@/hooks/useManagerTasks';

const taskSchema = z.object({
  title: z.string().min(1, 'נדרשת כותרת'),
  description: z.string().optional(),
  task_type: z.string().min(1, 'נדרש סוג משימה'),
  assigned_to: z.string().min(1, 'נדרש לבחור מקבל משימה'),
  vehicle_id: z.string().optional(),
  due_date: z.string().optional(),
  requires_document: z.boolean().default(true),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface User {
  id: string;
  full_name: string;
}

interface Vehicle {
  id: string;
  license_plate: string;
  make: string | null;
  model: string | null;
}

interface CreateTaskDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const CreateTaskDialog = ({ trigger, onSuccess }: CreateTaskDialogProps) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const { createTask } = useManagerTasks();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      task_type: 'test',
      requires_document: true,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      
      if (profilesData) {
        setUsers(profilesData.map(p => ({ id: p.user_id, full_name: p.full_name })));
      }

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from('fleet_vehicles')
        .select('id, license_plate, make, model')
        .eq('status', 'active')
        .order('license_plate');
      
      if (vehiclesData) {
        setVehicles(vehiclesData);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  const taskType = form.watch('task_type');

  // Auto-fill title based on task type
  useEffect(() => {
    const titles: Record<string, string> = {
      test: 'ביצוע טסט שנתי',
      maintenance: 'ביצוע טיפול לרכב',
      inspection: 'בדיקת רכב',
      document_renewal: 'חידוש מסמכים',
      other: '',
    };
    if (titles[taskType]) {
      form.setValue('title', titles[taskType]);
    }
  }, [taskType, form]);

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    try {
      const result = await createTask({
        title: data.title,
        description: data.description,
        task_type: data.task_type,
        assigned_to: data.assigned_to,
        vehicle_id: data.vehicle_id || undefined,
        due_date: data.due_date || undefined,
        requires_document: data.requires_document,
      });

      if (!result.error) {
        form.reset();
        setOpen(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <ClipboardPlus className="h-4 w-4 ml-2" />
            משימה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>יצירת משימה חדשה</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="task_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג משימה</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="test">טסט שנתי</SelectItem>
                      <SelectItem value="maintenance">טיפול רכב</SelectItem>
                      <SelectItem value="inspection">בדיקה</SelectItem>
                      <SelectItem value="document_renewal">חידוש מסמכים</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת המשימה</FormLabel>
                  <FormControl>
                    <Input placeholder="כותרת המשימה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="פרטים נוספים..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הקצה ל</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר משתמש" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicle_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>רכב (אופציונלי)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר רכב" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.license_plate} {v.make && v.model && `- ${v.make} ${v.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תאריך יעד</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requires_document"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">נדרש מסמך לסיום</FormLabel>
                    <p className="text-sm text-muted-foreground">המשתמש יצטרך להעלות מסמך לסגירת המשימה</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'יוצר משימה...' : 'צור משימה'}
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
