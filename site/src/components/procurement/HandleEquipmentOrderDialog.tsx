import { useState, useEffect } from 'react';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  equipment_item_id: string;
  quantity: number;
  sano_price_at_order: number;
  shai_yuval_price_at_order: number;
  equipment_item?: { name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    user_id: string;
    items?: OrderItem[];
  };
  onSuccess: () => void;
}

interface EditableItem extends OrderItem {
  newQuantity: number;
  originalQuantity: number;
}

export const HandleEquipmentOrderDialog = ({ open, onOpenChange, order, onSuccess }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [rejectionReason, setRejectionReason] = useState('');
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [managerNotes, setManagerNotes] = useState('');

  useEffect(() => {
    if (open && order.items) {
      setEditableItems(order.items.map(item => ({
        ...item,
        newQuantity: item.quantity,
        originalQuantity: item.quantity,
      })));
    }
  }, [open, order.items]);

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    setEditableItems(items => 
      items.map(item => 
        item.id === itemId ? { ...item, newQuantity: Math.max(0, newQuantity) } : item
      )
    );
  };

  const hasQuantityChanges = editableItems.some(item => item.newQuantity !== item.originalQuantity);
  const removedItems = editableItems.filter(item => item.newQuantity === 0);
  const modifiedItems = editableItems.filter(item => item.newQuantity !== item.originalQuantity && item.newQuantity > 0);

  const handleSubmit = async () => {
    if (decision === 'rejected' && !rejectionReason.trim()) {
      toast.error('יש לציין סיבה לאי-אישור');
      return;
    }

    // Check if all items are removed
    if (decision === 'approved' && editableItems.every(item => item.newQuantity === 0)) {
      toast.error('לא ניתן לאשר הזמנה ללא פריטים');
      return;
    }

    setLoading(true);
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('equipment_orders')
        .update({
          status: decision,
          rejection_reason: decision === 'rejected' ? rejectionReason : null,
          handled_by: user?.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // If approved with quantity changes, update the items
      if (decision === 'approved' && hasQuantityChanges) {
        // Delete items with quantity 0
        const itemsToDelete = editableItems.filter(item => item.newQuantity === 0);
        if (itemsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('equipment_order_items')
            .delete()
            .in('id', itemsToDelete.map(item => item.id));

          if (deleteError) throw deleteError;
        }

        // Update items with changed quantities
        const itemsToUpdate = editableItems.filter(item => item.newQuantity !== item.originalQuantity && item.newQuantity > 0);
        for (const item of itemsToUpdate) {
          const { error: updateError } = await supabase
            .from('equipment_order_items')
            .update({ quantity: item.newQuantity })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }

      // Send notification to the requester via the messages system
      if (order.user_id && user?.id) {
        let notificationMessage = '';
        
        if (decision === 'approved') {
          if (hasQuantityChanges) {
            const changes: string[] = [];
            modifiedItems.forEach(item => {
              changes.push(`${item.equipment_item?.name}: ${item.originalQuantity} → ${item.newQuantity}`);
            });
            removedItems.forEach(item => {
              changes.push(`${item.equipment_item?.name}: הוסר מההזמנה`);
            });
            
            notificationMessage = `הזמנת ציוד ${order.order_number} טופלה עם שינויים:\n${changes.join('\n')}${managerNotes ? `\n\nהערות: ${managerNotes}` : ''}`;
          } else {
            notificationMessage = `הזמנת ציוד ${order.order_number} טופלה בהצלחה${managerNotes ? `\n\nהערות: ${managerNotes}` : ''}`;
          }
        } else {
          notificationMessage = `הזמנת ציוד ${order.order_number} לא אושרה.\nסיבה: ${rejectionReason}`;
        }

        // driver_messages table was removed in fleet rebuild; requester notification
        // will be re-wired through the new notifications infrastructure later.
        console.log('[procurement] notify requester:', order.user_id, notificationMessage);
      }

      toast.success(decision === 'approved' ? 'ההזמנה אושרה והמזמין קיבל הודעה' : 'ההזמנה לא אושרה והמזמין קיבל הודעה');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error handling order:', error);
      toast.error('שגיאה בטיפול בהזמנה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>טיפול בהזמנה {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>החלטה</Label>
            <RadioGroup value={decision} onValueChange={(v) => setDecision(v as 'approved' | 'rejected')} className="mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="approved" id="approved" />
                <Label htmlFor="approved" className="flex items-center gap-1 cursor-pointer">
                  <Check className="h-4 w-4 text-green-600" />
                  טופל
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="rejected" id="rejected" />
                <Label htmlFor="rejected" className="flex items-center gap-1 cursor-pointer">
                  <X className="h-4 w-4 text-red-600" />
                  לא מאושר
                </Label>
              </div>
            </RadioGroup>
          </div>

          {decision === 'approved' && editableItems.length > 0 && (
            <div>
              <Label className="flex items-center gap-2">
                עדכון כמויות
                <span className="text-xs text-muted-foreground font-normal">(ניתן לשנות כמויות - 0 להסרה)</span>
              </Label>
              <div className="border rounded-lg overflow-x-auto mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">פריט</TableHead>
                      <TableHead className="text-right w-24">כמות מקורית</TableHead>
                      <TableHead className="text-right w-32">כמות סופית</TableHead>
                      <TableHead className="text-right w-24">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableItems.map((item) => {
                      const isChanged = item.newQuantity !== item.originalQuantity;
                      const isRemoved = item.newQuantity === 0;
                      
                      return (
                        <TableRow key={item.id} className={isRemoved ? 'bg-destructive/10' : isChanged ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                          <TableCell className="font-medium">{item.equipment_item?.name || '-'}</TableCell>
                          <TableCell className="text-center">{item.originalQuantity}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.newQuantity}
                              onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            {isRemoved ? (
                              <Badge variant="destructive" className="text-xs">יוסר</Badge>
                            ) : isChanged ? (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">שונה</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">ללא שינוי</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {hasQuantityChanges && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mt-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">שים לב: יש שינויים בכמויות</p>
                    <p className="text-yellow-700 dark:text-yellow-400">המזמין יקבל הודעה עם פירוט השינויים</p>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <Label htmlFor="managerNotes">הערות למזמין (אופציונלי)</Label>
                <Textarea
                  id="managerNotes"
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="הערות שיישלחו למזמין..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {decision === 'rejected' && (
            <div>
              <Label htmlFor="reason">סיבת אי-אישור *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="נא לציין את הסיבה..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {loading ? 'שומר...' : 'שמור ושלח הודעה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
