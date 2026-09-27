import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Plus, Package, Settings, Eye, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateEquipmentOrderDialog } from './CreateEquipmentOrderDialog';
import { ViewEquipmentOrderDialog } from './ViewEquipmentOrderDialog';
import { ManageEquipmentItemsDialog } from './ManageEquipmentItemsDialog';
import { HandleEquipmentOrderDialog } from './HandleEquipmentOrderDialog';

interface EquipmentOrder {
  id: string;
  order_number: string;
  user_id: string;
  client_id: string | null;
  branch_id: string | null;
  status: string;
  rejection_reason: string | null;
  handled_by: string | null;
  handled_at: string | null;
  notes: string | null;
  created_at: string;
  client?: { name: string } | null;
  branch?: { name: string } | null;
  requester?: { full_name: string } | null;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  equipment_item_id: string;
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

export const EquipmentOrdersDashboard = () => {
  const { user, isManager: isManagerRole, isSuperAdmin } = useAuth();
  const role = isSuperAdmin ? 'super_admin' : isManagerRole ? 'manager' : 'driver';
  const isManager = role === 'manager' || role === 'super_admin';
  
  const [orders, setOrders] = useState<EquipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageItemsDialogOpen, setManageItemsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EquipmentOrder | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [handleDialogOpen, setHandleDialogOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('equipment_orders')
        .select(`
          *,
          client:clients(name),
          branch:branches(name)
        `)
        .order('created_at', { ascending: false });

      // Non-managers only see their own orders
      if (!isManager) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch requester names and items for each order
      const ordersWithDetails = await Promise.all((data || []).map(async (order) => {
        // Get requester name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', order.user_id)
          .single();

        // Get order items with SKUs
        const { data: items } = await supabase
          .from('equipment_order_items')
          .select(`
            *,
            equipment_item:equipment_items(name, sano_sku, shai_yuval_sku)
          `)
          .eq('order_id', order.id);

        return {
          ...order,
          requester: profile,
          items: items || [],
        };
      }));

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('שגיאה בטעינת הזמנות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user, isManager]);

  const calculateOrderTotals = (items: OrderItem[]) => {
    const totalSano = items.reduce((sum, item) => sum + (item.sano_price_at_order * item.quantity), 0);
    const totalShaiYuval = items.reduce((sum, item) => sum + (item.shai_yuval_price_at_order * item.quantity), 0);
    return { totalSano, totalShaiYuval };
  };

  const handleViewOrder = (order: EquipmentOrder) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleProcessOrder = (order: EquipmentOrder) => {
    setSelectedOrder(order);
    setHandleDialogOpen(true);
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const approvedCount = orders.filter(o => o.status === 'approved').length;
  const rejectedCount = orders.filter(o => o.status === 'rejected').length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold">הזמנת ציוד</h2>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <Button variant="outline" onClick={() => setManageItemsDialogOpen(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">ניהול קטלוג</span>
              <span className="sm:hidden">קטלוג</span>
            </Button>
          )}
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">הזמנה חדשה</span>
            <span className="sm:hidden">הזמנה</span>
          </Button>
        </div>
      </div>

      {/* KPIs for managers */}
      {isManager && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-xs md:text-sm text-muted-foreground">ממתינות</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-green-600">{approvedCount}</div>
              <p className="text-xs md:text-sm text-muted-foreground">טופלו</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-red-600">{rejectedCount}</div>
              <p className="text-xs md:text-sm text-muted-foreground">לא אושרו</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            הזמנות
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין הזמנות להצגה
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מס׳ הזמנה</TableHead>
                    {isManager && <TableHead className="text-right hidden sm:table-cell">מבקש</TableHead>}
                    <TableHead className="text-right hidden md:table-cell">לקוח</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">סניף</TableHead>
                    {isManager && (
                      <>
                        <TableHead className="text-right hidden xl:table-cell">סה״כ סנו</TableHead>
                        <TableHead className="text-right hidden xl:table-cell">סה״כ שי יובל</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">תאריך</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const { totalSano, totalShaiYuval } = calculateOrderTotals(order.items || []);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        {isManager && (
                          <TableCell className="hidden sm:table-cell">{order.requester?.full_name || '-'}</TableCell>
                        )}
                        <TableCell className="hidden md:table-cell">{order.client?.name || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">{order.branch?.name || '-'}</TableCell>
                        {isManager && (
                          <>
                            <TableCell className="hidden xl:table-cell">₪{totalSano.toLocaleString()}</TableCell>
                            <TableCell className="hidden xl:table-cell">₪{totalShaiYuval.toLocaleString()}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <Badge className={statusColors[order.status]}>
                            {statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {format(new Date(order.created_at), 'dd/MM/yy', { locale: he })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewOrder(order)}
                              title="צפייה"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isManager && order.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleProcessOrder(order)}
                                title="טיפול"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateEquipmentOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchOrders}
      />
      
      {isManager && (
        <ManageEquipmentItemsDialog
          open={manageItemsDialogOpen}
          onOpenChange={setManageItemsDialogOpen}
        />
      )}

      {selectedOrder && (
        <>
          <ViewEquipmentOrderDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            order={selectedOrder}
            isManager={isManager}
          />
          
          {isManager && (
            <HandleEquipmentOrderDialog
              open={handleDialogOpen}
              onOpenChange={setHandleDialogOpen}
              order={selectedOrder}
              onSuccess={fetchOrders}
            />
          )}
        </>
      )}
    </div>
  );
};
