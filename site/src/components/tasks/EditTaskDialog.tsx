import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil } from 'lucide-react';
import { format } from 'date-fns';

interface EditTaskDialogProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    task_type: string;
    assigned_to: string;
    vehicle_id: string | null;
    due_date: string | null;
    requires_document: boolean | null;
    status: string;
  };
  onSuccess?: () => void;
}

const taskTypes = [
  { value: 'test', label: 'טסט שנתי' },
  { value: 'maintenance', label: 'טיפול רכב' },
  { value: 'inspection', label: 'בדיקה' },
  { value: 'document_renewal', label: 'חידוש מסמכים' },
  { value: 'other', label: 'אחר' },
];

export const EditTaskDialog = ({ task, onSuccess }: EditTaskDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: '',
    assigned_to: '',
    vehicle_id: '',
    due_date: '',
    requires_document: false,
  });

  useEffect(() => {
    if (task && open) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        task_type: task.task_type || '',
        assigned_to: task.assigned_to || '',
        vehicle_id: task.vehicle_id || '',
        due_date: task.due_date || '',
        requires_document: task.requires_document || false,
      });
    }
  }, [task, open]);

  const { data: users } = useQuery({
    queryKey: ['users-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('id, license_plate, make, model')
        .order('license_plate');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('manager_tasks')
        .update({
          title: formData.title,
          description: formData.description || null,
          task_type: formData.task_type,
          assigned_to: formData.assigned_to,
          vehicle_id: formData.vehicle_id || null,
          due_date: formData.due_date || null,
          requires_document: formData.requires_document,
        })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] });
      toast({ title: 'המשימה עודכנה בהצלחה' });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: 'שגיאה בעדכון משימה', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="עריכה"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>סוג משימה</Label>
            <Select
              value={formData.task_type}
              onValueChange={(v) => setFormData(p => ({ ...p, task_type: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>כותרת</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div>
            <Label>משויך ל</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(v) => setFormData(p => ({ ...p, assigned_to: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {users?.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>{user.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>רכב (אופציונלי)</Label>
            <Select
              value={formData.vehicle_id || 'none'}
              onValueChange={(v) => setFormData(p => ({ ...p, vehicle_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא רכב</SelectItem>
                {vehicles?.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.license_plate} {v.make && `- ${v.make} ${v.model || ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>תאריך יעד</Label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.requires_document}
              onCheckedChange={(v) => setFormData(p => ({ ...p, requires_document: v }))}
            />
            <Label>נדרש מסמך לאישור</Label>
          </div>
        </div>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            עדכן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
