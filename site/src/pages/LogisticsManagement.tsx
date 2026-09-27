import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Plus, Edit2, Trash2, Loader2, Package, CalendarIcon, Check, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LogisticsEquipment {
  id: string;
  equipment_type: string;
  equipment_type_other: string | null;
  order_date: string;
  vendor_name: string;
  client_id: string | null;
  branch_id: string | null;
  is_approved: boolean;
  equipment_cost: number;
  is_client_charged: boolean;
  client_charge_amount: number | null;
  notes: string | null;
  created_at: string;
  client?: { name: string } | null;
  branch?: { name: string } | null;
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

const EQUIPMENT_TYPES = [
  { value: 'vacuum', label: 'שואב' },
  { value: 'washing_machine', label: 'מכונת שטיפה' },
  { value: 'service_cart', label: 'עגלת שירות' },
  { value: 'other', label: 'אחר' },
];

const LogisticsManagement = () => {
  const { user, isManager, isSuperAdmin } = useAuth();
  const { canViewFinancialData } = useDataScope('logistics');
  const [equipment, setEquipment] = useState<LogisticsEquipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LogisticsEquipment | null>(null);
  const [saving, setSaving] = useState(false);

  // Only global scope users can view/edit financial data
  const canEditFinancials = canViewFinancialData;

  const [formData, setFormData] = useState({
    equipment_type: '',
    equipment_type_other: '',
    order_date: new Date(),
    vendor_name: '',
    client_id: '',
    branch_id: '',
    is_approved: false,
    equipment_cost: 0,
    is_client_charged: false,
    client_charge_amount: 0,
    notes: '',
  });

  const canManage = isManager || isSuperAdmin;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [equipmentRes, clientsRes, branchesRes] = await Promise.all([
        supabase
          .from('logistics_equipment')
          .select('*, client:clients(name), branch:branches(name)')
          .order('order_date', { ascending: false }),
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('branches').select('id, name, client_id').order('name'),
      ]);

      if (equipmentRes.data) setEquipment(equipmentRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = formData.client_id
    ? branches.filter(b => b.client_id === formData.client_id)
    : branches;

  const openNewDialog = () => {
    setEditingItem(null);
    setFormData({
      equipment_type: '',
      equipment_type_other: '',
      order_date: new Date(),
      vendor_name: '',
      client_id: '',
      branch_id: '',
      is_approved: false,
      equipment_cost: 0,
      is_client_charged: false,
      client_charge_amount: 0,
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: LogisticsEquipment) => {
    setEditingItem(item);
    setFormData({
      equipment_type: item.equipment_type,
      equipment_type_other: item.equipment_type_other || '',
      order_date: new Date(item.order_date),
      vendor_name: item.vendor_name,
      client_id: item.client_id || '',
      branch_id: item.branch_id || '',
      is_approved: item.is_approved,
      equipment_cost: item.equipment_cost,
      is_client_charged: item.is_client_charged,
      client_charge_amount: item.client_charge_amount || 0,
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.equipment_type || !formData.vendor_name || !formData.client_id) {
      toast.error('יש למלא סוג ציוד, ספק ולקוח');
      return;
    }

    setSaving(true);
    try {
      const data = {
        equipment_type: formData.equipment_type,
        equipment_type_other: formData.equipment_type === 'other' ? formData.equipment_type_other : null,
        order_date: format(formData.order_date, 'yyyy-MM-dd'),
        vendor_name: formData.vendor_name,
        client_id: formData.client_id || null,
        branch_id: formData.branch_id || null,
        is_approved: formData.is_approved,
        equipment_cost: formData.equipment_cost,
        is_client_charged: formData.is_client_charged,
        client_charge_amount: formData.is_client_charged ? formData.client_charge_amount : null,
        notes: formData.notes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('logistics_equipment')
          .update(data)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('הציוד עודכן בהצלחה');
      } else {
        const { error } = await supabase
          .from('logistics_equipment')
          .insert({ ...data, created_by: user!.id });

        if (error) throw error;
        toast.success('הציוד נוסף בהצלחה');
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את הציוד?')) return;

    try {
      const { error } = await supabase
        .from('logistics_equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('הציוד נמחק');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('שגיאה במחיקה');
    }
  };

  const getEquipmentTypeLabel = (type: string, other: string | null) => {
    if (type === 'other' && other) return other;
    return EQUIPMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  if (!canManage) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-7 w-7" />
              ניהול לוגיסטיקה
            </h1>
            <p className="text-muted-foreground">רישום ומעקב ציוד</p>
          </div>
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            הוספת ציוד
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>רשימת ציוד</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                אין ציוד להצגה
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">סוג ציוד</TableHead>
                      <TableHead className="text-right">תאריך הזמנה</TableHead>
                      <TableHead className="text-right">ספק</TableHead>
                      <TableHead className="text-right">לקוח</TableHead>
                      <TableHead className="text-right hidden md:table-cell">סניף</TableHead>
                      <TableHead className="text-right">באישור</TableHead>
                      {canEditFinancials && (
                        <>
                          <TableHead className="text-right">עלות</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">חיוב לקוח</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {getEquipmentTypeLabel(item.equipment_type, item.equipment_type_other)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.order_date), 'dd/MM/yyyy', { locale: he })}
                        </TableCell>
                        <TableCell>{item.vendor_name}</TableCell>
                        <TableCell>{item.client?.name || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{item.branch?.name || '-'}</TableCell>
                        <TableCell>
                          {item.is_approved ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <Check className="h-3 w-3 ml-1" />
                              מאושר
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 ml-1" />
                              לא
                            </Badge>
                          )}
                        </TableCell>
                        {canEditFinancials && (
                          <>
                            <TableCell>₪{item.equipment_cost.toLocaleString()}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {item.is_client_charged ? (
                                <span>₪{item.client_charge_amount?.toLocaleString() || 0}</span>
                              ) : (
                                <span className="text-muted-foreground">לא</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'עריכת ציוד' : 'הוספת ציוד חדש'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>סוג ציוד *</Label>
                  <Select value={formData.equipment_type} onValueChange={(v) => setFormData({ ...formData, equipment_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.equipment_type === 'other' && (
                  <div>
                    <Label>פרט סוג ציוד</Label>
                    <Input
                      value={formData.equipment_type_other}
                      onChange={(e) => setFormData({ ...formData, equipment_type_other: e.target.value })}
                      placeholder="תיאור הציוד"
                    />
                  </div>
                )}

                <div>
                  <Label>תאריך הזמנה *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-right")}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {format(formData.order_date, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.order_date}
                        onSelect={(date) => date && setFormData({ ...formData, order_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>ספק *</Label>
                <Input
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="שם הספק"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>לקוח *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v, branch_id: '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר לקוח" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>סניף</Label>
                  <Select value={formData.branch_id} onValueChange={(v) => setFormData({ ...formData, branch_id: v })} disabled={!formData.client_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סניף" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_approved}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_approved: checked })}
                  />
                  <Label>באישור</Label>
                </div>
              </div>

              {/* Financial fields - only for global scope users */}
              {canEditFinancials && (
                <>
                  <div>
                    <Label>עלות הציוד (₪)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.equipment_cost}
                      onChange={(e) => setFormData({ ...formData, equipment_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.is_client_charged}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_client_charged: checked })}
                      />
                      <Label>הלקוח מחויב</Label>
                    </div>
                    {formData.is_client_charged && (
                      <div>
                        <Label>סכום חיוב ללקוח (₪)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={formData.client_charge_amount}
                          onChange={(e) => setFormData({ ...formData, client_charge_amount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                {saving ? 'שומר...' : 'שמור'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default LogisticsManagement;
