import { useState, useEffect } from 'react';
import { Building2, FileText, DollarSign, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PurchaseRequest {
  id: string;
  quantity: number;
  vendor_name: string | null;
  po_number: string | null;
  unit_price: number | null;
  total_price: number | null;
  invoice_number: string | null;
  admin_notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PurchaseRequest;
  onSuccess: () => void;
}

export const EditManagerFieldsDialog = ({ open, onOpenChange, request, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendor_name: request.vendor_name || '',
    po_number: request.po_number || '',
    unit_price: request.unit_price?.toString() || '',
    invoice_number: request.invoice_number || '',
    admin_notes: request.admin_notes || '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        vendor_name: request.vendor_name || '',
        po_number: request.po_number || '',
        unit_price: request.unit_price?.toString() || '',
        invoice_number: request.invoice_number || '',
        admin_notes: request.admin_notes || '',
      });
    }
  }, [open, request]);

  const calculateTotalPrice = () => {
    const unitPrice = parseFloat(formData.unit_price) || 0;
    return unitPrice * request.quantity;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const unitPrice = parseFloat(formData.unit_price) || null;
      const totalPrice = unitPrice ? unitPrice * request.quantity : null;

      const { error } = await supabase
        .from('purchase_requests')
        .update({
          vendor_name: formData.vendor_name || null,
          po_number: formData.po_number || null,
          unit_price: unitPrice,
          total_price: totalPrice,
          invoice_number: formData.invoice_number || null,
          admin_notes: formData.admin_notes || null,
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('פרטי ההזמנה עודכנו בהצלחה');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('שגיאה בעדכון הפרטים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת פרטי ספק והזמנה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="vendor_name" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              שם הספק
            </Label>
            <Input
              id="vendor_name"
              value={formData.vendor_name}
              onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              placeholder="שם הספק או החברה"
            />
          </div>

          <div>
            <Label htmlFor="po_number" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              מספר הזמנה (PO)
            </Label>
            <Input
              id="po_number"
              value={formData.po_number}
              onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
              placeholder="מספר הזמנת הרכש"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit_price" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                מחיר ליחידה (₪)
              </Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                סה"כ (₪)
              </Label>
              <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center font-medium">
                ₪{calculateTotalPrice().toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                כמות: {request.quantity}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="invoice_number" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              מספר חשבונית
            </Label>
            <Input
              id="invoice_number"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              placeholder="מספר החשבונית"
            />
          </div>

          <div>
            <Label htmlFor="admin_notes">הערות מנהל (פנימי)</Label>
            <Textarea
              id="admin_notes"
              value={formData.admin_notes}
              onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
              placeholder="הערות פנימיות לשימוש מנהלים בלבד..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
