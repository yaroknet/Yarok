import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ManagerTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  vehicle_id: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string | null;
  status: string;
  requires_document: boolean;
  completion_document_url: string | null;
  completion_document_name: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useManagerTasks = () => {
  const { user, isManager } = useAuth();
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('manager_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createTask = async (task: {
    title: string;
    description?: string;
    task_type: string;
    vehicle_id?: string;
    assigned_to: string;
    due_date?: string;
    requires_document?: boolean;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('manager_tasks')
        .insert({
          ...task,
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => [...prev, data]);
      toast.success('המשימה נוצרה בהצלחה');
      return { data, error: null };
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('שגיאה ביצירת משימה');
      return { data: null, error };
    }
  };

  const updateTask = async (taskId: string, updates: Partial<ManagerTask>) => {
    try {
      const { data, error } = await supabase
        .from('manager_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
      return { data, error: null };
    } catch (error) {
      console.error('Error updating task:', error);
      return { data: null, error };
    }
  };

  const completeTask = async (taskId: string, documentUrl?: string, documentName?: string, notes?: string) => {
    const task = tasks.find(t => t.id === taskId);
    
    if (task?.requires_document && !documentUrl) {
      toast.error('נדרש להעלות מסמך לסיום המשימה');
      return { error: new Error('Document required') };
    }

    try {
      const { data, error } = await supabase
        .from('manager_tasks')
        .update({
          status: 'completed',
          completion_document_url: documentUrl,
          completion_document_name: documentName,
          completion_notes: notes,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
      toast.success('המשימה הושלמה בהצלחה');
      return { data, error: null };
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('שגיאה בסיום המשימה');
      return { data: null, error };
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('manager_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('המשימה נמחקה');
      return { error: null };
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('שגיאה במחיקת המשימה');
      return { error };
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const myTasks = tasks.filter(t => t.assigned_to === user?.id);
  const pendingTasks = myTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  return {
    tasks,
    myTasks,
    pendingTasks,
    isLoading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    refresh: fetchTasks,
  };
};
