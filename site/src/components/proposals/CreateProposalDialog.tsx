import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ServiceLine {
  id: string;
  service_description: string;
  frequency: string;
  price: string;
}

interface ClientUser {
  user_id: string;
  full_name: string;
  phone: string | null;
}

export function CreateProposalDialog({ open, onOpenChange, onSuccess }: CreateProposalDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  
  const [formData, setFormData] = useState({
    client_name: '',
    company_id: '',
    contact_person: '',
    contact_email: '',
    payment_terms: '8 ימים מהגשת חשבונית',
    materials: 'basic',
    notes: '',
    include_profile: false,
    include_client_form: true,
    client_user_id: ''
  });

  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([
    { id: crypto.randomUUID(), service_description: '', frequency: '', price: '' }
  ]);

  // Fetch client users
  useEffect(() => {
    const fetchClientUsers = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');
      
      if (error) {
        console.error('Error fetching client users:', error);
        return;
      }

      if (data && data.length > 0) {
        const userIds = data.map(r => r.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', userIds);
        
        if (!profilesError && profiles) {
          setClientUsers(profiles);
        }
      }
    };

    if (open) {
      fetchClientUsers();
    }
  }, [open]);

  const addServiceLine = () => {
    setServiceLines(prev => [...prev, { 
      id: crypto.randomUUID(), 
      service_description: '', 
      frequency: '', 
      price: '' 
    }]);
  };

  const removeServiceLine = (id: string) => {
    if (serviceLines.length > 1) {
      setServiceLines(prev => prev.filter(line => line.id !== id));
    }
  };

  const updateServiceLine = (id: string, field: keyof ServiceLine, value: string) => {
    setServiceLines(prev => prev.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const calculateTotal = () => {
    return serviceLines.reduce((sum, line) => sum + (parseFloat(line.price) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Validate required fields
    if (!formData.client_name || !formData.contact_person || !formData.contact_email) {
      toast.error('נא למלא את כל השדות הנדרשים');
      return;
    }

    // Validate at least one service line
    const validServices = serviceLines.filter(s => s.service_description && s.price);
    if (validServices.length === 0) {
      toast.error('נא להוסיף לפחות שירות אחד');
      return;
    }

    setLoading(true);
    try {
      // Create the proposal
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          client_name: formData.client_name,
          company_id: formData.company_id || null,
          contact_person: formData.contact_person,
          contact_email: formData.contact_email,
          service_type: validServices[0].service_description, // Keep for backward compatibility
          frequency: validServices[0].frequency || null,
          location: '',
          price: calculateTotal(),
          payment_terms: formData.payment_terms,
          materials: formData.materials,
          notes: formData.notes || null,
          include_profile: formData.include_profile,
          include_client_form: formData.include_client_form,
          created_by: user.id,
          proposal_number: '',
          client_user_id: formData.client_user_id || null
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Insert service lines
      const servicesToInsert = validServices.map((service, index) => ({
        proposal_id: proposal.id,
        service_description: service.service_description,
        frequency: service.frequency || null,
        price: parseFloat(service.price),
        sort_order: index
      }));

      const { error: servicesError } = await supabase
        .from('proposal_services')
        .insert(servicesToInsert);

      if (servicesError) throw servicesError;

      toast.success('ההצעה נוצרה בהצלחה');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        client_name: '',
        company_id: '',
        contact_person: '',
        contact_email: '',
        payment_terms: '8 ימים מהגשת חשבונית',
        materials: 'basic',
        notes: '',
        include_profile: false,
        include_client_form: true,
        client_user_id: ''
      });
      setServiceLines([{ id: crypto.randomUUID(), service_description: '', frequency: '', price: '' }]);
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      toast.error('שגיאה ביצירת ההצעה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הצעת מחיר חדשה</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">שם לקוח *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="שם הלקוח או החברה"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_id">ח.פ</Label>
              <Input
                id="company_id"
                value={formData.company_id}
                onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                placeholder="מספר חברה (אופציונלי)"
                dir="ltr"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact_person">איש קשר *</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="שם איש הקשר"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact_email">מייל איש קשר *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
          </div>

          {/* Client User Selection */}
          {clientUsers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="client_user_id">שיוך לאזור אישי של לקוח (אופציונלי)</Label>
              <Select
                value={formData.client_user_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, client_user_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח לשיוך" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא שיוך</SelectItem>
                  {clientUsers.map(client => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.full_name} {client.phone ? `(${client.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">הלקוח יראה הצעה זו באזור האישי שלו</p>
            </div>
          )}

          {/* Service Details Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">פרטי השירות</Label>
              <Button type="button" variant="outline" size="sm" onClick={addServiceLine}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף שורה
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-3 text-right font-medium border-l w-2/5">תיאור השירות</th>
                    <th className="p-3 text-right font-medium border-l w-1/4">תדירות השירות</th>
                    <th className="p-3 text-right font-medium w-1/4">סכום שעתי לפני מע"מ</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {serviceLines.map((line, index) => (
                    <tr key={line.id} className={index > 0 ? 'border-t' : ''}>
                      <td className="p-2 border-l">
                        <Input
                          value={line.service_description}
                          onChange={(e) => updateServiceLine(line.id, 'service_description', e.target.value)}
                          placeholder="למשל: ניקיון משרדים"
                          className="border-0 shadow-none"
                        />
                      </td>
                      <td className="p-2 border-l">
                        <Input
                          value={line.frequency}
                          onChange={(e) => updateServiceLine(line.id, 'frequency', e.target.value)}
                          placeholder="למשל: יומי / שבועי"
                          className="border-0 shadow-none"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span>₪</span>
                          <Input
                            type="number"
                            value={line.price}
                            onChange={(e) => updateServiceLine(line.id, 'price', e.target.value)}
                            placeholder="0"
                            dir="ltr"
                            className="border-0 shadow-none"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        {serviceLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeServiceLine(line.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="border-t bg-muted/30">
                    <td colSpan={2} className="p-3 text-left font-bold border-l">סה"כ:</td>
                    <td colSpan={2} className="p-3 font-bold text-lg">₪{calculateTotal().toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms">תנאי תשלום</Label>
            <Input
              id="payment_terms"
              value={formData.payment_terms}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
            />
          </div>

          {/* Materials Section */}
          <div className="space-y-3">
            <Label>חומרים</Label>
            <RadioGroup
              value={formData.materials}
              onValueChange={(value) => setFormData(prev => ({ ...prev, materials: value }))}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="basic" id="basic" />
                <Label htmlFor="basic" className="font-normal">כולל חומרי ניקיון בסיסיים בלבד</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="toiletries" id="toiletries" />
                <Label htmlFor="toiletries" className="font-normal">כולל חומרים ומוצרי טואלטיקה</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="font-normal">ללא חומרים כלל</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not_relevant" id="not_relevant" />
                <Label htmlFor="not_relevant" className="font-normal">לא רלוונטי</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="הערות נוספות להצעה"
              rows={3}
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>צרף פרופיל חברה</Label>
                <p className="text-xs text-muted-foreground">יצורף לסוף המסמך</p>
              </div>
              <Switch
                checked={formData.include_profile}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, include_profile: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>צרף טופס לקוח</Label>
                <p className="text-xs text-muted-foreground">הלקוח ימלא פרטים וחתימה</p>
              </div>
              <Switch
                checked={formData.include_client_form}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, include_client_form: checked }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'יוצר...' : 'צור הצעה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}