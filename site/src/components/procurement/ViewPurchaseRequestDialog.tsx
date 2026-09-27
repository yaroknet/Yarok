import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  Calendar, User, Package, FileText, Building2, 
  Receipt, DollarSign, Clock, CheckCircle, XCircle, Truck 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PurchaseRequest {
  id: string;
  user_id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  justification: string;
  needed_by_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'completed';
  rejection_reason: string | null;
  vendor_name: string | null;
  po_number: string | null;
  unit_price: number | null;
  total_price: number | null;
  invoice_number: string | null;
  admin_notes: string | null;
  created_at: string;
  user?: { full_name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PurchaseRequest;
  canViewSensitive: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'ממתין לאישור', icon: Clock, className: 'bg-yellow-500' },
  approved: { label: 'מאושר', icon: CheckCircle, className: 'bg-green-500' },
  rejected: { label: 'נדחה', icon: XCircle, className: 'bg-destructive' },
  ordered: { label: 'הוזמן', icon: Truck, className: 'bg-blue-500' },
  completed: { label: 'הושלם', icon: Package, className: 'bg-emerald-600' },
};

export const ViewPurchaseRequestDialog = ({ open, onOpenChange, request, canViewSensitive }: Props) => {
  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {request.item_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className={`${statusConfig.className} text-base px-4 py-2`}>
              <StatusIcon className="h-4 w-4 ml-2" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Rejection Reason */}
          {request.status === 'rejected' && request.rejection_reason && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>סיבת הדחייה:</strong> {request.rejection_reason}
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">פרטי הבקשה</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">מבקש:</span>
                <span className="font-medium">{request.user?.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">כמות:</span>
                <span className="font-medium">{request.quantity}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">נדרש עד:</span>
                <span className="font-medium">{format(new Date(request.needed_by_date), 'dd/MM/yyyy')}</span>
              </div>
            </div>

            {request.description && (
              <div>
                <span className="text-sm text-muted-foreground">תיאור:</span>
                <p className="mt-1 text-sm">{request.description}</p>
              </div>
            )}

            <div>
              <span className="text-sm text-muted-foreground">נימוק:</span>
              <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{request.justification}</p>
            </div>
          </div>

          {/* Manager Fields - Only visible to managers */}
          {canViewSensitive && (request.vendor_name || request.po_number || request.total_price || request.admin_notes) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">פרטי ספק והזמנה (מידע פנימי)</h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {request.vendor_name && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">ספק:</span>
                      <span className="font-medium">{request.vendor_name}</span>
                    </div>
                  )}
                  {request.po_number && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">מס' הזמנה:</span>
                      <span className="font-medium">{request.po_number}</span>
                    </div>
                  )}
                  {request.unit_price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">מחיר יחידה:</span>
                      <span className="font-medium">₪{request.unit_price.toLocaleString()}</span>
                    </div>
                  )}
                  {request.total_price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">סה"כ:</span>
                      <span className="font-medium text-primary">₪{request.total_price.toLocaleString()}</span>
                    </div>
                  )}
                  {request.invoice_number && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">מס' חשבונית:</span>
                      <span className="font-medium">{request.invoice_number}</span>
                    </div>
                  )}
                </div>

                {request.admin_notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">הערות מנהל:</span>
                    <p className="mt-1 text-sm bg-primary/5 p-3 rounded-lg border border-primary/20">
                      {request.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            נוצר ב: {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
