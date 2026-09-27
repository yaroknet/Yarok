import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { AlertTriangle, User, Phone, MapPin, Building, Calendar, Clock, FileText, Paperclip } from 'lucide-react';
import { ComplaintAttachmentsList } from './ComplaintAttachmentsList';
import { ComplaintFileUpload } from './ComplaintFileUpload';
import { useAuth } from '@/contexts/AuthContext';

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

interface ViewComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: Complaint;
}

export function ViewComplaintDialog({ open, onOpenChange, complaint }: ViewComplaintDialogProps) {
  const { isSuperAdmin, isManager } = useAuth();
  const [refreshAttachments, setRefreshAttachments] = useState(0);
  const canManage = isSuperAdmin || isManager;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive">פתוח</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-500 hover:bg-amber-600">בטיפול</Badge>;
      case 'closed':
        return <Badge variant="secondary">סגור</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>פרטי תלונה</span>
            {getStatusBadge(complaint.status)}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Alerts */}
            {(complaint.customerComplaintCount > 2 || complaint.managerComplaintCount > 2) && (
              <div className="space-y-2">
                {complaint.customerComplaintCount > 2 && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="text-destructive font-medium">
                      לקוח חוזר - {complaint.customerComplaintCount} תלונות ב-6 חודשים אחרונים
                    </span>
                  </div>
                )}
                {complaint.managerComplaintCount > 2 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-amber-600 font-medium">
                      נדרשת תשומת לב - {complaint.managerComplaintCount} תלונות על מנהל זה ב-14 ימים אחרונים
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-lg mb-3">פרטי לקוח</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">שם:</span>
                  <span className="font-medium">{complaint.customer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">טלפון:</span>
                  <span className="font-medium" dir="ltr">{complaint.customer_phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">סניף:</span>
                  <span className="font-medium">{complaint.branch_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">עיר:</span>
                  <span className="font-medium">{complaint.city}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Complaint Info */}
            <div>
              <h3 className="font-semibold text-lg mb-3">פרטי התלונה</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">מנהל אחראי:</span>
                    <span className="font-medium">{complaint.manager_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">תאריך אירוע:</span>
                    <span className="font-medium">
                      {format(new Date(complaint.incident_date), 'dd/MM/yyyy', { locale: he })}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">תיאור התלונה:</span>
                  </div>
                  <p className="bg-muted/50 p-3 rounded-lg">{complaint.complaint_description}</p>
                </div>
                
                {complaint.resolution_details && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">פרטי טיפול:</span>
                    </div>
                    <p className="bg-muted/50 p-3 rounded-lg">{complaint.resolution_details}</p>
                  </div>
                )}
                
                {complaint.notes && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">הערות פנימיות:</span>
                    </div>
                    <p className="bg-muted/50 p-3 rounded-lg">{complaint.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Attachments Section */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                קבצים מצורפים
              </h3>
              <ComplaintAttachmentsList 
                complaintId={complaint.id} 
                refreshTrigger={refreshAttachments}
              />
              {canManage && (
                <div className="mt-4">
                  <ComplaintFileUpload 
                    complaintId={complaint.id}
                    onUploadComplete={() => setRefreshAttachments(prev => prev + 1)}
                  />
                </div>
              )}
            </div>

            <Separator />
            {complaint.history_log && complaint.history_log.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">היסטוריית פעולות</h3>
                <div className="space-y-2">
                  {complaint.history_log.map((log: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: he })}
                      </span>
                      <span className="text-sm">{log.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground">
              <p>נוצר: {format(new Date(complaint.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
