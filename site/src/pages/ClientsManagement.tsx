import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, Building2, Phone, Mail, MapPin, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  auto_send_report: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
}

const ClientsManagement = () => {
  const { isSuperAdmin, isManager } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    auto_send_report: false,
  });
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    address: '',
    contact_name: '',
    phone: '',
  });

  const canEdit = isSuperAdmin || isManager;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (branchesError) throw branchesError;
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        contact_name: client.contact_name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || '',
        auto_send_report: client.auto_send_report,
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        auto_send_report: false,
      });
    }
    setDialogOpen(true);
  };

  const handleOpenBranchDialog = (clientId: string, branch?: Branch) => {
    setSelectedClientId(clientId);
    if (branch) {
      setEditingBranch(branch);
      setBranchFormData({
        name: branch.name,
        address: branch.address || '',
        contact_name: branch.contact_name || '',
        phone: branch.phone || '',
      });
    } else {
      setEditingBranch(null);
      setBranchFormData({
        name: '',
        address: '',
        contact_name: '',
        phone: '',
      });
    }
    setBranchDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name.trim()) {
      toast.error('שם הלקוח הוא שדה חובה');
      return;
    }

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            contact_name: formData.contact_name || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            notes: formData.notes || null,
            auto_send_report: formData.auto_send_report,
          })
          .eq('id', editingClient.id);

        if (error) throw error;
        toast.success('הלקוח עודכן בהצלחה');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({
            name: formData.name,
            contact_name: formData.contact_name || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            notes: formData.notes || null,
            auto_send_report: formData.auto_send_report,
          });

        if (error) throw error;
        toast.success('הלקוח נוסף בהצלחה');
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('שגיאה בשמירת הלקוח');
    }
  };

  const handleSaveBranch = async () => {
    if (!branchFormData.name.trim() || !selectedClientId) {
      toast.error('שם הסניף הוא שדה חובה');
      return;
    }

    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update({
            name: branchFormData.name,
            address: branchFormData.address || null,
            contact_name: branchFormData.contact_name || null,
            phone: branchFormData.phone || null,
          })
          .eq('id', editingBranch.id);

        if (error) throw error;
        toast.success('הסניף עודכן בהצלחה');
      } else {
        const { error } = await supabase
          .from('branches')
          .insert({
            client_id: selectedClientId,
            name: branchFormData.name,
            address: branchFormData.address || null,
            contact_name: branchFormData.contact_name || null,
            phone: branchFormData.phone || null,
          });

        if (error) throw error;
        toast.success('הסניף נוסף בהצלחה');
      }

      setBranchDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error('שגיאה בשמירת הסניף');
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו תמחק גם את כל הסניפים שלו.')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast.success('הלקוח נמחק בהצלחה');
      fetchData();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('שגיאה במחיקת הלקוח');
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק סניף זה?')) return;

    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      toast.success('הסניף נמחק בהצלחה');
      fetchData();
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('שגיאה במחיקת הסניף');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientBranches = (clientId: string) => 
    branches.filter(b => b.client_id === clientId);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<{ 'שם מקור דיווח': string }>(worksheet);

      if (jsonData.length === 0) {
        toast.error('הקובץ ריק או שהפורמט לא תקין');
        return;
      }

      // Check if the expected column exists
      const firstRow = jsonData[0];
      if (!('שם מקור דיווח' in firstRow)) {
        toast.error('הקובץ חייב להכיל עמודה בשם "שם מקור דיווח"');
        return;
      }

      let newCount = 0;
      let existingCount = 0;

      for (const row of jsonData) {
        const clientName = row['שם מקור דיווח']?.toString().trim();
        if (!clientName) continue;

        // Check if client already exists
        const existingClient = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        if (existingClient) {
          existingCount++;
          continue;
        }

        // Insert new client
        const { error } = await supabase
          .from('clients')
          .insert({ name: clientName });

        if (!error) {
          newCount++;
        }
      }

      toast.success(`הייבוא הושלם: ${newCount} לקוחות חדשים נוספו, ${existingCount} כבר קיימים`);
      fetchData();
    } catch (error) {
      console.error('Error importing Excel:', error);
      toast.error('שגיאה בייבוא הקובץ');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול לקוחות</h1>
          <p className="text-muted-foreground">ניהול לקוחות וסניפים</p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2" />
              ) : (
                <Upload className="h-4 w-4 ml-2" />
              )}
              ייבוא מאקסל
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 ml-2" />
              לקוח חדש
            </Button>
          </div>
        )}
        {canEdit && !isSuperAdmin && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 ml-2" />
            לקוח חדש
          </Button>
        )}
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם, איש קשר או כתובת..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              לא נמצאו לקוחות
            </CardContent>
          </Card>
        ) : (
          filteredClients.map(client => {
            const clientBranches = getClientBranches(client.id);
            
            return (
              <Card key={client.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {client.name}
                          {client.auto_send_report && (
                            <Badge variant="secondary" className="text-xs">שליחה אוטומטית</Badge>
                          )}
                        </CardTitle>
                        {client.contact_name && (
                          <p className="text-sm text-muted-foreground">{client.contact_name}</p>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(client)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{client.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Branches */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-sm">סניפים ({clientBranches.length})</h4>
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenBranchDialog(client.id)}>
                          <Plus className="h-3 w-3 ml-1" />
                          סניף חדש
                        </Button>
                      )}
                    </div>
                    {clientBranches.length > 0 ? (
                      <div className="space-y-2">
                        {clientBranches.map(branch => (
                          <div key={branch.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{branch.name}</p>
                              {branch.address && (
                                <p className="text-xs text-muted-foreground">{branch.address}</p>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenBranchDialog(client.id, branch)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteBranch(branch.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">אין סניפים</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'עריכת לקוח' : 'לקוח חדש'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">שם הלקוח *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="contact_name">איש קשר</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">טלפון</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">כתובת</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="auto_send"
                checked={formData.auto_send_report}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_send_report: checked })}
              />
              <Label htmlFor="auto_send">שליחת דוחות אוטומטית</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSaveClient}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'עריכת סניף' : 'סניף חדש'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="branch_name">שם הסניף *</Label>
              <Input
                id="branch_name"
                value={branchFormData.name}
                onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="branch_address">כתובת</Label>
              <Input
                id="branch_address"
                value={branchFormData.address}
                onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="branch_contact">איש קשר</Label>
              <Input
                id="branch_contact"
                value={branchFormData.contact_name}
                onChange={(e) => setBranchFormData({ ...branchFormData, contact_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="branch_phone">טלפון</Label>
              <Input
                id="branch_phone"
                value={branchFormData.phone}
                onChange={(e) => setBranchFormData({ ...branchFormData, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSaveBranch}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsManagement;
