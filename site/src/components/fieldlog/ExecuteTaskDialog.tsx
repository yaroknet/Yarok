import { useState, useRef } from 'react';
import { Upload, Check, AlertTriangle, Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  description: string | null;
  special_notes: string | null;
  special_notes_confirmed: boolean;
  requires_media: boolean;
  media_urls: string[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onSuccess: () => void;
}

export const ExecuteTaskDialog = ({ open, onOpenChange, task, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [specialNotesConfirmed, setSpecialNotesConfirmed] = useState(false);
  const [mediaUploaded, setMediaUploaded] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canComplete = () => {
    if (task.special_notes && !specialNotesConfirmed) return false;
    if (task.requires_media && !mediaUploaded) return false;
    return true;
  };

  // Signature pad handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleMediaUpload = () => {
    // Simulate upload - in production, this would handle actual file upload
    setMediaUploaded(true);
    toast.success('התמונה הועלתה בהצלחה');
  };

  const handleComplete = async () => {
    if (!canComplete()) {
      toast.error('יש להשלים את כל הדרישות לפני סיום המשימה');
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, any> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes || null,
        special_notes_confirmed: task.special_notes ? specialNotesConfirmed : null,
      };

      if (signatureData) {
        updateData.signature_url = signatureData;
      }

      if (mediaUploaded) {
        updateData.media_urls = ['simulated-upload-url'];
      }

      const { error } = await supabase
        .from('field_tasks')
        .update(updateData)
        .eq('id', task.id);

      if (error) throw error;

      toast.success('המשימה הושלמה בהצלחה');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('שגיאה בהשלמת המשימה');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProgress = async () => {
    try {
      const { error } = await supabase
        .from('field_tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id);

      if (error) throw error;
      toast.success('המשימה מסומנת כבביצוע');
      onSuccess();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ביצוע משימה: {task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Description */}
          {task.description && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          {/* Special Notes Warning */}
          {task.special_notes && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div>
                  <strong>הנחיות מיוחדות:</strong>
                  <p className="mt-1">{task.special_notes}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="confirm_notes"
                    checked={specialNotesConfirmed}
                    onCheckedChange={(checked) => setSpecialNotesConfirmed(checked === true)}
                  />
                  <Label htmlFor="confirm_notes" className="text-sm cursor-pointer">
                    קראתי ואישרתי את ההנחיות המיוחדות
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Media Upload Requirement */}
          {task.requires_media && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="font-medium">צילום נדרש</Label>
                {mediaUploaded && <Badge className="bg-green-500"><Check className="h-3 w-3 ml-1" />הועלה</Badge>}
              </div>
              <Button 
                variant={mediaUploaded ? "outline" : "default"} 
                onClick={handleMediaUpload}
                className="w-full"
              >
                <Upload className="h-4 w-4 ml-2" />
                {mediaUploaded ? 'העלה תמונה נוספת' : 'העלה תמונה'}
              </Button>
            </div>
          )}

          {/* Signature Pad */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="font-medium flex items-center gap-2">
                <Pen className="h-4 w-4" />
                חתימת לקוח
              </Label>
              <Button variant="ghost" size="sm" onClick={clearSignature}>
                נקה
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="border rounded-lg bg-white w-full touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Completion Notes */}
          <div>
            <Label htmlFor="completion_notes">הערות ביצוע</Label>
            <Textarea
              id="completion_notes"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="הערות על ביצוע העבודה..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button variant="secondary" onClick={handleStartProgress}>
            סמן כבביצוע
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={loading || !canComplete()}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'שומר...' : 'סיים משימה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
