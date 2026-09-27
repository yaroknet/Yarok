import { useState, useEffect, useMemo } from 'react';
import { escapeHtml } from '@/lib/escapeHtml';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Plus, Search, Filter, FileText, Clock, CheckCircle, XCircle,
  Truck, Package, Eye, Edit, Trash2, DollarSign, TrendingUp,
  Download, Users, Building, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_contact: string | null;
  department: string;
  project_site: string | null;
  order_date: string;
  delivery_date: string | null;
  items: OrderItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  payment_terms: string;
  status: string;
  notes: string | null;
  created_by: string;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  finance_approved_by: string | null;
  finance_approved_at: string | null;
  created_at: string;
  creator_name?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'sent', label: 'נשלח' },
  { value: 'approved', label: 'מאושר' },
  { value: 'delivered', label: 'נמסר' },
  { value: 'closed', label: 'סגור' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  draft: { label: 'טיוטה', icon: FileText, className: 'bg-gray-500' },
  sent: { label: 'נשלח', icon: Truck, className: 'bg-blue-500' },
  approved: { label: 'מאושר', icon: CheckCircle, className: 'bg-green-500' },
  delivered: { label: 'נמסר', icon: Package, className: 'bg-purple-500' },
  closed: { label: 'סגור', icon: CheckCircle, className: 'bg-emerald-600' },
};

const DEPARTMENTS = [
  'מנהלה',
  'תפעול',
  'לוגיסטיקה',
  'שיווק',
  'כספים',
  'משאבי אנוש',
  'אחר'
];

export const PurchaseOrdersDashboard = () => {
  const { user, isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_contact: '',
    department: '',
    project_site: '',
    order_date: new Date(),
    delivery_date: null as Date | null,
    items: [{ name: '', quantity: 1, unit_price: 0, total: 0 }] as OrderItem[],
    vat_rate: 18,
    payment_terms: 'שוטף + 30',
    notes: '',
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(o => o.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        const enrichedOrders = data.map(order => ({
          ...order,
          items: (Array.isArray(order.items) ? order.items : []) as unknown as OrderItem[],
          creator_name: profileMap.get(order.created_by) || 'לא ידוע'
        })) as PurchaseOrder[];

        setOrders(enrichedOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('שגיאה בטעינת ההזמנות');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.project_site?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesDepartment = departmentFilter === 'all' || order.department === departmentFilter;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [orders, searchTerm, statusFilter, departmentFilter]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const thisMonthOrders = orders.filter(o => {
      const orderDate = new Date(o.order_date);
      return orderDate >= monthStart && orderDate <= monthEnd;
    });

    return {
      totalThisMonth: thisMonthOrders.length,
      totalSpend: thisMonthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      openOrders: orders.filter(o => ['draft', 'sent', 'approved'].includes(o.status)).length,
      pendingApproval: orders.filter(o => o.status === 'sent').length,
      approved: orders.filter(o => o.status === 'approved').length,
      closed: orders.filter(o => o.status === 'closed').length,
    };
  }, [orders]);

  const updateItemTotal = (index: number, field: 'quantity' | 'unit_price', value: number) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
      total: field === 'quantity' 
        ? value * newItems[index].unit_price 
        : newItems[index].quantity * value
    };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', quantity: 1, unit_price: 0, total: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = subtotal * (formData.vat_rate / 100);
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  };

  const handleCreate = async () => {
    if (!formData.supplier_name || !formData.department) {
      toast.error('יש למלא שם ספק ומחלקה');
      return;
    }

    const validItems = formData.items.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      toast.error('יש להוסיף לפחות פריט אחד');
      return;
    }

    try {
      const { subtotal, vatAmount, total } = calculateTotals();

      const orderData = {
        order_number: '', // Will be auto-generated by trigger
        supplier_name: formData.supplier_name,
        supplier_contact: formData.supplier_contact || null,
        department: formData.department,
        project_site: formData.project_site || null,
        order_date: format(formData.order_date, 'yyyy-MM-dd'),
        delivery_date: formData.delivery_date ? format(formData.delivery_date, 'yyyy-MM-dd') : null,
        items: JSON.parse(JSON.stringify(validItems)),
        subtotal,
        vat_rate: formData.vat_rate,
        vat_amount: vatAmount,
        total_amount: total,
        payment_terms: formData.payment_terms,
        notes: formData.notes || null,
        created_by: user?.id!,
        status: 'draft'
      };

      const { error } = await supabase
        .from('purchase_orders')
        .insert([orderData]);

      if (error) throw error;

      toast.success('ההזמנה נוצרה בהצלחה');
      setCreateDialogOpen(false);
      resetForm();
      fetchOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('שגיאה ביצירת ההזמנה');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: '',
      supplier_contact: '',
      department: '',
      project_site: '',
      order_date: new Date(),
      delivery_date: null,
      items: [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
      vat_rate: 18,
      payment_terms: 'שוטף + 30',
      notes: '',
    });
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'approved' && !selectedOrder?.manager_approved_at) {
        updateData.manager_approved_by = user?.id;
        updateData.manager_approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      toast.success('הסטטוס עודכן בהצלחה');
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('שגיאה בעדכון הסטטוס');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('ההזמנה נמחקה בהצלחה');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('שגיאה במחיקת ההזמנה');
    }
  };

  const downloadPdf = async (order: PurchaseOrder) => {
    setDownloadingPdf(order.id);
    try {
      const container = document.createElement('div');
      container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 794px; background: white; font-family: "Segoe UI", Tahoma, Arial, sans-serif;';
      container.dir = 'rtl';

      container.innerHTML = `
        <div style="padding: 40px; font-size: 14px; line-height: 1.8; color: #1a1a1a;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px;">
            <div>
              <h1 style="font-size: 28px; color: #16a34a; margin: 0;">הזמנת רכש</h1>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">מספר: ${escapeHtml(order.order_number)}</p>
            </div>
            <div style="text-align: left;">
              <p style="margin: 0; font-size: 12px; color: #666;">תאריך הזמנה: ${format(new Date(order.order_date), 'dd/MM/yyyy')}</p>
              ${order.delivery_date ? `<p style="margin: 0; font-size: 12px; color: #666;">תאריך אספקה: ${format(new Date(order.delivery_date), 'dd/MM/yyyy')}</p>` : ''}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: #f8faf8; padding: 15px; border-radius: 8px; border-right: 4px solid #16a34a;">
              <h3 style="margin: 0 0 10px 0; color: #16a34a; font-size: 14px;">פרטי ספק</h3>
              <p style="margin: 5px 0; font-weight: 600;">${escapeHtml(order.supplier_name)}</p>
              ${order.supplier_contact ? `<p style="margin: 5px 0; font-size: 13px;">${escapeHtml(order.supplier_contact)}</p>` : ''}
            </div>
            <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-right: 4px solid #3b82f6;">
              <h3 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 14px;">פרטי הזמנה</h3>
              <p style="margin: 5px 0;">מחלקה: ${escapeHtml(order.department)}</p>
              ${order.project_site ? `<p style="margin: 5px 0;">פרויקט/אתר: ${escapeHtml(order.project_site)}</p>` : ''}
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #16a34a; color: white;">
                <th style="padding: 12px; text-align: right;">#</th>
                <th style="padding: 12px; text-align: right;">תיאור פריט</th>
                <th style="padding: 12px; text-align: center;">כמות</th>
                <th style="padding: 12px; text-align: center;">מחיר יחידה</th>
                <th style="padding: 12px; text-align: center;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">₪${Number(item.unit_price).toLocaleString()}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">₪${Number(item.total).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 250px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span>סה"כ לפני מע"מ:</span>
                <span>₪${Number(order.subtotal).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span>מע"מ (${order.vat_rate}%):</span>
                <span>₪${Number(order.vat_amount).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: 700; color: #16a34a;">
                <span>סה"כ לתשלום:</span>
                <span>₪${Number(order.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 5px 0;"><strong>תנאי תשלום:</strong> ${escapeHtml(order.payment_terms)}</p>
            ${order.notes ? `<p style="margin: 10px 0 0 0;"><strong>הערות:</strong> ${escapeHtml(order.notes)}</p>` : ''}
          </div>

          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div style="text-align: center;">
              <div style="border-top: 2px solid #333; width: 150px; margin-top: 40px;"></div>
              <p style="margin: 5px 0 0 0; font-size: 12px;">חתימת מנהל</p>
            </div>
            <div style="text-align: center;">
              <div style="border-top: 2px solid #333; width: 150px; margin-top: 40px;"></div>
              <p style="margin: 5px 0 0 0; font-size: 12px;">חתימת כספים</p>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`הזמנה-${order.order_number}.pdf`);

      toast.success('ה-PDF הורד בהצלחה');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('שגיאה ביצירת ה-PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { subtotal, vatAmount, total } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalThisMonth}</p>
                <p className="text-xs text-muted-foreground">הזמנות החודש</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">₪{stats.totalSpend.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">סה"כ הוצאות</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.openOrders}</p>
                <p className="text-xs text-muted-foreground">הזמנות פתוחות</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingApproval}</p>
                <p className="text-xs text-muted-foreground">ממתינות לאישור</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">מאושרות</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-500/10 border-gray-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">{stats.closed}</p>
                <p className="text-xs text-muted-foreground">סגורות</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              הזמנה חדשה
            </Button>
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי מספר הזמנה, ספק, מחלקה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="מחלקה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המחלקות</SelectItem>
                {DEPARTMENTS.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>הזמנות רכש ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מס' הזמנה</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>מחלקה</TableHead>
                  <TableHead>סה"כ</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      לא נמצאו הזמנות
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map(order => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                        <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{order.supplier_name}</TableCell>
                        <TableCell>{order.department}</TableCell>
                        <TableCell className="font-medium">₪{Number(order.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.className}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedOrder(order);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => downloadPdf(order)}
                              disabled={downloadingPdf === order.id}
                            >
                              <Download className={`h-4 w-4 ${downloadingPdf === order.id ? 'animate-pulse' : ''}`} />
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(order.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>הזמנת רכש חדשה</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>שם ספק *</Label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="שם הספק"
                />
              </div>
              <div>
                <Label>פרטי קשר ספק</Label>
                <Input
                  value={formData.supplier_contact}
                  onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                  placeholder="טלפון / אימייל"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מחלקה *</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר מחלקה" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>פרויקט / אתר</Label>
                <Input
                  value={formData.project_site}
                  onChange={(e) => setFormData({ ...formData, project_site: e.target.value })}
                  placeholder="שם הפרויקט או האתר"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך הזמנה</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-right">
                      <Calendar className="ml-2 h-4 w-4" />
                      {format(formData.order_date, 'dd/MM/yyyy', { locale: he })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={formData.order_date}
                      onSelect={(date) => date && setFormData({ ...formData, order_date: date })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>תאריך אספקה מבוקש</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-right">
                      <Calendar className="ml-2 h-4 w-4" />
                      {formData.delivery_date ? format(formData.delivery_date, 'dd/MM/yyyy', { locale: he }) : 'בחר תאריך'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={formData.delivery_date || undefined}
                      onSelect={(date) => setFormData({ ...formData, delivery_date: date || null })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Items */}
            <div>
              <Label className="mb-2 block">פריטים</Label>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-5"
                      placeholder="שם פריט"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index] = { ...newItems[index], name: e.target.value };
                        setFormData({ ...formData, items: newItems });
                      }}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="כמות"
                      value={item.quantity}
                      onChange={(e) => updateItemTotal(index, 'quantity', Number(e.target.value))}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="מחיר"
                      value={item.unit_price}
                      onChange={(e) => updateItemTotal(index, 'unit_price', Number(e.target.value))}
                    />
                    <div className="col-span-2 text-sm font-medium">
                      ₪{item.total.toLocaleString()}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addItem}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף פריט
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span>סה"כ לפני מע"מ:</span>
                <span className="font-medium">₪{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>מע"מ ({formData.vat_rate}%):</span>
                <span className="font-medium">₪{vatAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-primary">
                <span>סה"כ לתשלום:</span>
                <span>₪{total.toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תנאי תשלום</Label>
                <Input
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                />
              </div>
              <div>
                <Label>אחוז מע"מ</Label>
                <Input
                  type="number"
                  value={formData.vat_rate}
                  onChange={(e) => setFormData({ ...formData, vat_rate: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreate}>
              צור הזמנה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>הזמנה {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ספק</p>
                  <p className="font-medium">{selectedOrder.supplier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">מחלקה</p>
                  <p className="font-medium">{selectedOrder.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">תאריך הזמנה</p>
                  <p className="font-medium">{format(new Date(selectedOrder.order_date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">סטטוס</p>
                  <Badge className={STATUS_CONFIG[selectedOrder.status]?.className || 'bg-gray-500'}>
                    {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">פריטים</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>פריט</TableHead>
                        <TableHead>כמות</TableHead>
                        <TableHead>מחיר יחידה</TableHead>
                        <TableHead>סה"כ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₪{Number(item.unit_price).toLocaleString()}</TableCell>
                          <TableCell>₪{Number(item.total).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between mb-1">
                  <span>סה"כ לפני מע"מ:</span>
                  <span>₪{Number(selectedOrder.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>מע"מ:</span>
                  <span>₪{Number(selectedOrder.vat_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-primary">
                  <span>סה"כ:</span>
                  <span>₪{Number(selectedOrder.total_amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex gap-2">
                {selectedOrder.status === 'draft' && (
                  <Button onClick={() => updateStatus(selectedOrder.id, 'sent')}>
                    שלח לאישור
                  </Button>
                )}
                {selectedOrder.status === 'sent' && (
                  <Button onClick={() => updateStatus(selectedOrder.id, 'approved')} className="bg-green-600 hover:bg-green-700">
                    אשר הזמנה
                  </Button>
                )}
                {selectedOrder.status === 'approved' && (
                  <Button onClick={() => updateStatus(selectedOrder.id, 'delivered')}>
                    סמן כנמסר
                  </Button>
                )}
                {selectedOrder.status === 'delivered' && (
                  <Button onClick={() => updateStatus(selectedOrder.id, 'closed')} variant="secondary">
                    סגור הזמנה
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
