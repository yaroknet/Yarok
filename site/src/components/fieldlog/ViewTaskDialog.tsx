import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar, User, MapPin, FileText, CheckCircle, Clock, Image } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Task {
  id: string;
  title: string;
  description: string | null;
  job_type: string;
  address: string | null;
  frequency: string;
  deadline: string | null;
  status: string;
  special_notes: string | null;
  special_notes_confirmed: boolean;
  requires_media: boolean;
  media_urls: string[] | null;
  signature_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  client?: { name: string };
  assigned_user?: { full_name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  cleaning: 'ניקיון',
  maintenance: 'אחזקה',
  gardening: 'גינון',
  security: 'אבטחה',
  other: 'אחר',
};

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: 'חד פעמי',
  daily: 'יומי',
  weekly: 'שבועי',
  bi_weekly: 'דו-שבועי',
  monthly: 'חודשי',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'ממתין', className: 'bg-yellow-500' },
  in_progress: { label: 'בביצוע', className: 'bg-blue-500' },
  completed: { label: 'הושלם', className: 'bg-green-500' },
  cancelled: { label: 'בוטל', className: 'bg-destructive' },
};

export const ViewTaskDialog = ({ open, onOpenChange, task }: Props) => {
  const statusInfo = STATUS_BADGES[task.status] || { label: task.status, className: 'bg-gray-500' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.title}
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">משויך ל:</span>
              <span className="font-medium">{task.assigned_user?.full_name || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">סוג:</span>
              <span className="font-medium">{JOB_TYPE_LABELS[task.job_type] || task.job_type}</span>
            </div>
            {task.client && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">לקוח:</span>
                <span className="font-medium">{task.client.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">תדירות:</span>
              <span className="font-medium">{FREQUENCY_LABELS[task.frequency] || task.frequency}</span>
            </div>
          </div>

          {task.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{task.address}</span>
            </div>
          )}

          {task.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">תאריך יעד:</span>
              <span className="font-medium">{format(new Date(task.deadline), 'dd/MM/yyyy')}</span>
            </div>
          )}

          {task.description && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">תיאור</h4>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
            </>
          )}

          {task.special_notes && (
            <>
              <Separator />
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <h4 className="font-medium text-destructive mb-2">הנחיות מיוחדות</h4>
                <p className="text-sm">{task.special_notes}</p>
                {task.special_notes_confirmed && (
                  <Badge className="mt-2 bg-green-500">
                    <CheckCircle className="h-3 w-3 ml-1" />
                    אושר על ידי העובד
                  </Badge>
                )}
              </div>
            </>
          )}

          {task.requires_media && (
            <div className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">צילום נדרש:</span>
              {task.media_urls && task.media_urls.length > 0 ? (
                <Badge className="bg-green-500">הועלה</Badge>
              ) : (
                <Badge variant="secondary">טרם הועלה</Badge>
              )}
            </div>
          )}

          {/* Completion Info */}
          {task.status === 'completed' && (
            <>
              <Separator />
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  פרטי השלמה
                </h4>
                {task.completed_at && (
                  <p className="text-sm flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3" />
                    הושלם ב: {format(new Date(task.completed_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                  </p>
                )}
                {task.completion_notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">הערות ביצוע:</span>
                    <p className="text-sm mt-1">{task.completion_notes}</p>
                  </div>
                )}
                {task.signature_url && (
                  <div className="mt-3">
                    <span className="text-sm text-muted-foreground block mb-2">חתימת לקוח:</span>
                    <img 
                      src={task.signature_url} 
                      alt="חתימה" 
                      className="border rounded-lg bg-white max-h-24"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Created At */}
          <div className="text-xs text-muted-foreground">
            נוצר ב: {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
