import { useState, useRef } from 'react';
import { Upload, CheckCircle, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useManagerTasks } from '@/hooks/useManagerTasks';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  requires_document: boolean;
}

interface CompleteTaskDialogProps {
  task: Task;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const CompleteTaskDialog = ({ task, trigger, onSuccess }: CompleteTaskDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { completeTask } = useManagerTasks();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('גודל הקובץ חורג מ-10MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (task.requires_document && !file) {
      toast.error('נדרש להעלות מסמך לסיום המשימה');
      return;
    }

    setIsUploading(true);
    try {
      let documentUrl: string | undefined;
      let documentName: string | undefined;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${task.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        documentUrl = publicUrl;
        documentName = file.name;
      }

      const result = await completeTask(task.id, documentUrl, documentName, notes);

      if (!result.error) {
        setOpen(false);
        setFile(null);
        setNotes('');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('שגיאה בסיום המשימה');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <CheckCircle className="h-4 w-4 ml-1" />
            סיים משימה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>סיום משימה: {task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {task.requires_document && (
            <div>
              <Label>העלאת מסמך (חובה)</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
              />
              {file ? (
                <div className="mt-2 flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mt-2 h-20 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">לחץ להעלאת מסמך</span>
                  </div>
                </Button>
              )}
            </div>
          )}

          <div>
            <Label>הערות (אופציונלי)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הוסף הערות על ביצוע המשימה..."
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={isUploading || (task.requires_document && !file)}
              className="flex-1"
            >
              {isUploading ? 'מעלה ומסיים...' : 'סיים משימה'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
