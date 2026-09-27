import { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Client {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  client_id: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  sano_price: number;
  shai_yuval_price: number;
  sano_sku: string | null;
  shai_yuval_sku: string | null;
}

interface OrderLine {
  equipment_item_id: string;
  quantity: number;
  searchQuery: string;
}

export const CreateEquipmentOrderDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    setSelectedBranchId('');
  }, [selectedClientId]);

  const fetchData = async () => {
    try {
      const [clientsRes, branchesRes, itemsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('branches').select('id, name, client_id').order('name'),
        supabase.from('equipment_items').select('*').eq('is_active', true).order('name'),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (itemsRes.data) setEquipmentItems(itemsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת נתונים');
    }
  };

  const filteredBranches = selectedClientId 
    ? branches.filter(b => b.client_id === selectedClientId)
    : branches;

  const addOrderLine = () => {
    if (equipmentItems.length === 0) {
      toast.error('אין פריטים זמינים בקטלוג');
      return;
    }
    setOrderLines([...orderLines, { equipment_item_id: '', quantity: 1, searchQuery: '' }]);
  };

  const removeOrderLine = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const updateOrderLine = (index: number, field: keyof OrderLine, value: string | number) => {
    const updated = [...orderLines];
    updated[index] = { ...updated[index], [field]: value };
    setOrderLines(updated);
  };

  // Get filtered items for a specific order line
  const getFilteredItemsForLine = (searchQuery: string) => {
    if (!searchQuery.trim()) return equipmentItems;
    const query = searchQuery.toLowerCase();
    return equipmentItems.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.sano_sku?.toLowerCase().includes(query) ||
      item.shai_yuval_sku?.toLowerCase().includes(query)
    );
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      toast.error('יש לבחור לקוח');
      return;
    }
    if (orderLines.length === 0) {
      toast.error('יש להוסיף לפחות פריט אחד');
      return;
    }
    if (orderLines.some(line => !line.equipment_item_id)) {
      toast.error('יש לבחור פריט בכל השורות');
      return;
    }

    setLoading(true);
    try {
      const { data: orderNumber } = await supabase.rpc('generate_equipment_order_number');

      const { data: order, error: orderError } = await supabase
        .from('equipment_orders')
        .insert({
          order_number: orderNumber,
          user_id: user!.id,
          client_id: selectedClientId,
          branch_id: selectedBranchId || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = orderLines.map(line => {
        const item = equipmentItems.find(i => i.id === line.equipment_item_id);
        return {
          order_id: order.id,
          equipment_item_id: line.equipment_item_id,
          quantity: line.quantity,
          sano_price_at_order: item?.sano_price || 0,
          shai_yuval_price_at_order: item?.shai_yuval_price || 0,
          sano_sku_at_order: item?.sano_sku || null,
          shai_yuval_sku_at_order: item?.shai_yuval_sku || null,
        };
      });

      const { error: itemsError } = await supabase
        .from('equipment_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success('ההזמנה נשלחה בהצלחה');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('שגיאה ביצירת ההזמנה');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedBranchId('');
    setOrderLines([]);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>הזמנת ציוד חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>לקוח *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>סניף</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={!selectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סניף" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>פריטים להזמנה *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOrderLine}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף פריט
              </Button>
            </div>

            {orderLines.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right min-w-[200px]">חיפוש ובחירת פריט</TableHead>
                      <TableHead className="text-right w-24">כמות</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((line, index) => {
                      const filteredItems = getFilteredItemsForLine(line.searchQuery);
                      const selectedItem = equipmentItems.find(i => i.id === line.equipment_item_id);
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="space-y-2">
                              <div className="relative">
                                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="חפש לפי שם, תיאור או מק״ט..."
                                  value={line.searchQuery}
                                  onChange={(e) => updateOrderLine(index, 'searchQuery', e.target.value)}
                                  className="pr-8 text-sm"
                                />
                              </div>
                              <Select 
                                value={line.equipment_item_id} 
                                onValueChange={(v) => updateOrderLine(index, 'equipment_item_id', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="בחר פריט">
                                    {selectedItem?.name || 'בחר פריט'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredItems.length === 0 ? (
                                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                      לא נמצאו פריטים
                                    </div>
                                  ) : (
                                    filteredItems.map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        <div className="flex flex-col">
                                          <span>{item.name}</span>
                                          {(item.sano_sku || item.shai_yuval_sku) && (
                                            <span className="text-xs text-muted-foreground">
                                              {item.sano_sku && `סנו: ${item.sano_sku}`}
                                              {item.sano_sku && item.shai_yuval_sku && ' | '}
                                              {item.shai_yuval_sku && `שי יובל: ${item.shai_yuval_sku}`}
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => updateOrderLine(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOrderLine(index)}
                            >
                              <Minus className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {orderLines.length === 0 && (
              <div className="text-center py-4 text-muted-foreground border rounded-lg">
                לחץ על "הוסף פריט" להוספת פריטים להזמנה
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות להזמנה..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            {loading ? 'שולח...' : 'שלח הזמנה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
