import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface OrderItem {
  id: string;
  quantity: number;
  sano_price_at_order: number;
  shai_yuval_price_at_order: number;
  sano_sku_at_order?: string | null;
  shai_yuval_sku_at_order?: string | null;
  equipment_item?: { 
    name: string;
    sano_sku?: string | null;
    shai_yuval_sku?: string | null;
  };
}

interface EquipmentOrder {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  handled_at: string | null;
  client?: { name: string } | null;
  branch?: { name: string } | null;
  requester?: { full_name: string } | null;
  items?: OrderItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: EquipmentOrder;
  isManager: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<string, string> = {
  pending: 'ממתין לטיפול',
  approved: 'טופל',
  rejected: 'לא מאושר',
};

export const ViewEquipmentOrderDialog = ({ open, onOpenChange, order, isManager }: Props) => {
  const items = order.items || [];
  
  const totalSano = items.reduce((sum, item) => sum + (item.sano_price_at_order * item.quantity), 0);
  const totalShaiYuval = items.reduce((sum, item) => sum + (item.shai_yuval_price_at_order * item.quantity), 0);

  const exportToExcel = () => {
    // Build CSV content with BOM for Hebrew support
    const BOM = '\uFEFF';
    const headers = isManager 
      ? ['פריט', 'מק״ט סנו', 'מחיר סנו', 'כמות', 'סה״כ סנו', 'מק״ט שי יובל', 'מחיר שי יובל', 'סה״כ שי יובל']
      : ['פריט', 'כמות'];
    
    const rows = items.map(item => {
      const sanoSku = item.sano_sku_at_order || item.equipment_item?.sano_sku || '';
      const shaiYuvalSku = item.shai_yuval_sku_at_order || item.equipment_item?.shai_yuval_sku || '';
      
      if (isManager) {
        return [
          item.equipment_item?.name || '',
          sanoSku,
          item.sano_price_at_order,
          item.quantity,
          item.sano_price_at_order * item.quantity,
          shaiYuvalSku,
          item.shai_yuval_price_at_order,
          item.shai_yuval_price_at_order * item.quantity,
        ];
      }
      return [
        item.equipment_item?.name || '',
        item.quantity,
      ];
    });

    // Add totals row for managers
    if (isManager) {
      rows.push(['', '', '', '', '', '', '', '']);
      rows.push(['סה״כ', '', '', '', totalSano, '', '', totalShaiYuval]);
    }

    // Add order info at the top
    const orderInfo = [
      ['הזמנת ציוד מס׳', order.order_number],
      ['לקוח', order.client?.name || '-'],
      ['סניף', order.branch?.name || '-'],
      ['מבקש', order.requester?.full_name || '-'],
      ['תאריך', format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: he })],
      ['סטטוס', statusLabels[order.status]],
      order.notes ? ['הערות', order.notes] : null,
      ['', ''],
    ].filter(Boolean) as string[][];

    const csvContent = BOM + [
      ...orderInfo.map(row => row.join(',')),
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `הזמנת_ציוד_${order.order_number}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              הזמנה {order.order_number}
              <Badge className={statusColors[order.status]}>
                {statusLabels[order.status]}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              ייצוא לאקסל
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">לקוח:</span>
              <span className="mr-2 font-medium">{order.client?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">סניף:</span>
              <span className="mr-2 font-medium">{order.branch?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">מבקש:</span>
              <span className="mr-2 font-medium">{order.requester?.full_name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">תאריך:</span>
              <span className="mr-2 font-medium">
                {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
              </span>
            </div>
          </div>

          {order.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">הערות:</span>
              <p className="mt-1">{order.notes}</p>
            </div>
          )}

          {order.status === 'rejected' && order.rejection_reason && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <span className="font-medium text-destructive">סיבת אי-אישור:</span>
              <p className="mt-1">{order.rejection_reason}</p>
            </div>
          )}

          <Separator />

          {/* Items Table */}
          <div>
            <h4 className="font-medium mb-2">פריטים</h4>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">פריט</TableHead>
                    <TableHead className="text-right">כמות</TableHead>
                    {isManager && (
                      <>
                        <TableHead className="text-right">מק״ט סנו</TableHead>
                        <TableHead className="text-right">מחיר סנו</TableHead>
                        <TableHead className="text-right">סה״כ סנו</TableHead>
                        <TableHead className="text-right">מק״ט שי יובל</TableHead>
                        <TableHead className="text-right">מחיר שי יובל</TableHead>
                        <TableHead className="text-right">סה״כ שי יובל</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const sanoSku = item.sano_sku_at_order || item.equipment_item?.sano_sku || '-';
                    const shaiYuvalSku = item.shai_yuval_sku_at_order || item.equipment_item?.shai_yuval_sku || '-';
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.equipment_item?.name || '-'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        {isManager && (
                          <>
                            <TableCell>{sanoSku}</TableCell>
                            <TableCell>₪{item.sano_price_at_order.toLocaleString()}</TableCell>
                            <TableCell>₪{(item.sano_price_at_order * item.quantity).toLocaleString()}</TableCell>
                            <TableCell>{shaiYuvalSku}</TableCell>
                            <TableCell>₪{item.shai_yuval_price_at_order.toLocaleString()}</TableCell>
                            <TableCell>₪{(item.shai_yuval_price_at_order * item.quantity).toLocaleString()}</TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals for managers */}
          {isManager && items.length > 0 && (
            <div className="flex justify-end gap-6 text-sm font-medium">
              <div>
                <span className="text-muted-foreground">סה״כ סנו:</span>
                <span className="mr-2">₪{totalSano.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">סה״כ שי יובל:</span>
                <span className="mr-2">₪{totalShaiYuval.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
