import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, X, Upload, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  sano_price: number;
  shai_yuval_price: number;
  sano_sku: string | null;
  shai_yuval_sku: string | null;
  sano_units_per_package: number;
  shai_yuval_units_per_package: number;
  is_active: boolean;
}

interface EditingItem {
  id?: string;
  name: string;
  description: string;
  sano_price: number;
  shai_yuval_price: number;
  sano_sku: string;
  shai_yuval_sku: string;
  sano_units_per_package: number;
  shai_yuval_units_per_package: number;
  is_active: boolean;
}

export const ManageEquipmentItemsDialog = ({ open, onOpenChange }: Props) => {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.sano_sku?.toLowerCase().includes(query) ||
      item.shai_yuval_sku?.toLowerCase().includes(query)
    );
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('שגיאה בטעינת פריטים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open]);

  const startNewItem = () => {
    setEditingItem({
      name: '',
      description: '',
      sano_price: 0,
      shai_yuval_price: 0,
      sano_sku: '',
      shai_yuval_sku: '',
      sano_units_per_package: 1,
      shai_yuval_units_per_package: 1,
      is_active: true,
    });
  };

  const startEditItem = (item: EquipmentItem) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      description: item.description || '',
      sano_price: item.sano_price,
      shai_yuval_price: item.shai_yuval_price,
      sano_sku: item.sano_sku || '',
      shai_yuval_sku: item.shai_yuval_sku || '',
      sano_units_per_package: item.sano_units_per_package || 1,
      shai_yuval_units_per_package: item.shai_yuval_units_per_package || 1,
      is_active: item.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveItem = async () => {
    if (!editingItem?.name.trim()) {
      toast.error('שם הפריט הוא שדה חובה');
      return;
    }

    setSaving(true);
    try {
      if (editingItem.id) {
        const { error } = await supabase
          .from('equipment_items')
          .update({
            name: editingItem.name,
            description: editingItem.description || null,
            sano_price: editingItem.sano_price,
            shai_yuval_price: editingItem.shai_yuval_price,
            sano_sku: editingItem.sano_sku || null,
            shai_yuval_sku: editingItem.shai_yuval_sku || null,
            sano_units_per_package: editingItem.sano_units_per_package,
            shai_yuval_units_per_package: editingItem.shai_yuval_units_per_package,
            is_active: editingItem.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('הפריט עודכן בהצלחה');
      } else {
        const { error } = await supabase
          .from('equipment_items')
          .insert({
            name: editingItem.name,
            description: editingItem.description || null,
            sano_price: editingItem.sano_price,
            shai_yuval_price: editingItem.shai_yuval_price,
            sano_sku: editingItem.sano_sku || null,
            shai_yuval_sku: editingItem.shai_yuval_sku || null,
            sano_units_per_package: editingItem.sano_units_per_package,
            shai_yuval_units_per_package: editingItem.shai_yuval_units_per_package,
            is_active: editingItem.is_active,
          });

        if (error) throw error;
        toast.success('הפריט נוסף בהצלחה');
      }

      setEditingItem(null);
      fetchItems();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('שגיאה בשמירת הפריט');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('האם למחוק את הפריט?')) return;

    try {
      const { error } = await supabase
        .from('equipment_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('הפריט נמחק');
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('שגיאה במחיקת הפריט');
    }
  };

  const downloadTemplate = () => {
    const BOM = '\uFEFF';
    const headers = ['שם הפריט', 'תיאור', 'מק״ט סנו', 'מחיר סנו', 'כמות באריזה סנו', 'מק״ט שי יובל', 'מחיר שי יובל', 'כמות באריזה שי יובל'];
    const exampleRow = ['מגב רצפה', 'מגב מקצועי 40 ס״מ', 'SN-12345', '25.90', '6', 'SY-54321', '22.50', '12'];
    
    const csvContent = BOM + [
      headers.join(','),
      exampleRow.join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'תבנית_קטלוג_ציוד.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('הקובץ ריק או חסרות שורות נתונים');
        return;
      }

      // Skip header row
      const dataRows = lines.slice(1);
      const newItems: Omit<EquipmentItem, 'id'>[] = [];

      for (const line of dataRows) {
        const values = parseCSVLine(line);
        
        if (values.length < 4 || !values[0]) {
          continue; // Skip invalid rows
        }

        const [name, description, sanoSku, sanoPriceStr, sanoUnitsStr, shaiYuvalSku, shaiYuvalPriceStr, shaiYuvalUnitsStr] = values;
        
        const sanoPrice = parseFloat(sanoPriceStr?.replace(/[^\d.-]/g, '') || '0') || 0;
        const shaiYuvalPrice = parseFloat(shaiYuvalPriceStr?.replace(/[^\d.-]/g, '') || '0') || 0;
        const sanoUnits = parseInt(sanoUnitsStr?.replace(/[^\d]/g, '') || '1') || 1;
        const shaiYuvalUnits = parseInt(shaiYuvalUnitsStr?.replace(/[^\d]/g, '') || '1') || 1;

        newItems.push({
          name: name.trim(),
          description: description?.trim() || null,
          sano_sku: sanoSku?.trim() || null,
          sano_price: sanoPrice,
          sano_units_per_package: sanoUnits,
          shai_yuval_sku: shaiYuvalSku?.trim() || null,
          shai_yuval_price: shaiYuvalPrice,
          shai_yuval_units_per_package: shaiYuvalUnits,
          is_active: true,
        });
      }

      if (newItems.length === 0) {
        toast.error('לא נמצאו פריטים תקינים בקובץ');
        return;
      }

      const { error } = await supabase
        .from('equipment_items')
        .insert(newItems);

      if (error) throw error;

      toast.success(`יובאו ${newItems.length} פריטים בהצלחה`);
      fetchItems();
    } catch (error) {
      console.error('Error importing items:', error);
      toast.error('שגיאה בייבוא הקובץ');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const exportCatalog = () => {
    const BOM = '\uFEFF';
    const headers = ['שם הפריט', 'תיאור', 'מק״ט סנו', 'מחיר סנו', 'כמות באריזה סנו', 'מק״ט שי יובל', 'מחיר שי יובל', 'כמות באריזה שי יובל', 'פעיל'];
    
    const rows = items.map(item => [
      item.name,
      item.description || '',
      item.sano_sku || '',
      item.sano_price.toString(),
      (item.sano_units_per_package || 1).toString(),
      item.shai_yuval_sku || '',
      item.shai_yuval_price.toString(),
      (item.shai_yuval_units_per_package || 1).toString(),
      item.is_active ? 'כן' : 'לא',
    ]);

    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'קטלוג_ציוד.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>ניהול קטלוג ציוד</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
                <Download className="h-4 w-4" />
                הורד תבנית
              </Button>
              <Button variant="outline" size="sm" onClick={exportCatalog} className="gap-1" disabled={items.length === 0}>
                <Download className="h-4 w-4" />
                ייצוא קטלוג
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-1">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                ייבוא מאקסל
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleImport}
                className="hidden"
              />
              <Button onClick={startNewItem} size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                פריט חדש
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-2">
          לייבוא מאקסל: שמור את הקובץ כ-CSV (UTF-8) ולחץ על "ייבוא מאקסל". הורד תבנית לדוגמה.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, תיאור או מק״ט..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם הפריט</TableHead>
                  <TableHead className="text-right">תיאור</TableHead>
                  <TableHead className="text-right">מק״ט סנו</TableHead>
                  <TableHead className="text-right">מחיר סנו</TableHead>
                  <TableHead className="text-right">כמות באריזה סנו</TableHead>
                  <TableHead className="text-right">מק״ט שי יובל</TableHead>
                  <TableHead className="text-right">מחיר שי יובל</TableHead>
                  <TableHead className="text-right">כמות באריזה שי יובל</TableHead>
                  <TableHead className="text-right">פעיל</TableHead>
                  <TableHead className="text-right w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Editing/New Row */}
                {editingItem && (
                  <TableRow className="bg-muted/50">
                    <TableCell>
                      <Input
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        placeholder="שם הפריט"
                        className="min-w-[120px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editingItem.description}
                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                        placeholder="תיאור"
                        className="min-w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editingItem.sano_sku}
                        onChange={(e) => setEditingItem({ ...editingItem, sano_sku: e.target.value })}
                        placeholder="מק״ט"
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editingItem.sano_price}
                        onChange={(e) => setEditingItem({ ...editingItem, sano_price: parseFloat(e.target.value) || 0 })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editingItem.sano_units_per_package}
                        onChange={(e) => setEditingItem({ ...editingItem, sano_units_per_package: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editingItem.shai_yuval_sku}
                        onChange={(e) => setEditingItem({ ...editingItem, shai_yuval_sku: e.target.value })}
                        placeholder="מק״ט"
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editingItem.shai_yuval_price}
                        onChange={(e) => setEditingItem({ ...editingItem, shai_yuval_price: parseFloat(e.target.value) || 0 })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editingItem.shai_yuval_units_per_package}
                        onChange={(e) => setEditingItem({ ...editingItem, shai_yuval_units_per_package: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={editingItem.is_active}
                        onCheckedChange={(checked) => setEditingItem({ ...editingItem, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={saveItem} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-600" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEdit}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Existing Items */}
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.description || '-'}</TableCell>
                    <TableCell>{item.sano_sku || '-'}</TableCell>
                    <TableCell>₪{item.sano_price.toLocaleString()}</TableCell>
                    <TableCell>{item.sano_units_per_package || 1}</TableCell>
                    <TableCell>{item.shai_yuval_sku || '-'}</TableCell>
                    <TableCell>₪{item.shai_yuval_price.toLocaleString()}</TableCell>
                    <TableCell>{item.shai_yuval_units_per_package || 1}</TableCell>
                    <TableCell>{item.is_active ? 'כן' : 'לא'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEditItem(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredItems.length === 0 && !editingItem && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'לא נמצאו פריטים התואמים לחיפוש' : 'אין פריטים בקטלוג. לחץ על "פריט חדש" להוספת פריט או "ייבוא מאקסל" לייבוא קטלוג.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
