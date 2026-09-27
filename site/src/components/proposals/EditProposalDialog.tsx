import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Proposal {
  id: string;
  proposal_number: string;
  client_name: string;
  company_id: string | null;
  contact_person: string;
  contact_email: string;
  service_type: string;
  frequency?: string | null;
  location: string;
  price: number;
  payment_terms: string;
  materials: string;
  notes: string | null;
  include_profile: boolean;
  include_client_form: boolean;
  status: string;
}

interface ServiceLine {
  id: string;
  service_description: string;
  frequency: string;
  price: string;
  isNew?: boolean;
}

interface EditProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  onSuccess: () => void;
}

export function EditProposalDialog({ open, onOpenChange, proposal, onSuccess }: EditProposalDialogProps) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    client_name: '',
    company_id: '',
    contact_person: '',
    contact_email: '',
    payment_terms: '',
    materials: 'basic',
    notes: '',
    include_profile: false,
    include_client_form: true
  });

  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);

  useEffect(() => {
    if (open && proposal) {
      setFormData({
        client_name: proposal.client_name || '',
        company_id: proposal.company_id || '',
        contact_person: proposal.contact_person || '',
        contact_email: proposal.contact_email || '',
        payment_terms: proposal.payment_terms || '8 ימים מהגשת חשבונית',
        materials: proposal.materials || 'basic',
        notes: proposal.notes || '',
        include_profile: proposal.include_profile || false,
        include_client_form: proposal.include_client_form ?? true
      });
      fetchServices();
    }
  }, [open, proposal]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('proposal_services')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('sort_order');

    if (!error && data && data.length > 0) {
      setServiceLines(data.map(s => ({
        id: s.id,
        service_description: s.service_description,
        frequency: s.frequency || '',
        price: String(s.price)
      })));
    } else {
      // Fallback to main proposal data
      setServiceLines([{
        id: crypto.randomUUID(),
        service_description: proposal.service_type,
        frequency: proposal.frequency || '',
        price: String(proposal.price),
        isNew: true
      }]);
    }
  };

  const addServiceLine = () => {
    setServiceLines(prev => [...prev, { 
      id: crypto.randomUUID(), 
      service_description: '', 
      frequency: '', 
      price: '',
      isNew: true
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
      // Update the proposal
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({
          client_name: formData.client_name,
          company_id: formData.company_id || null,
          contact_person: formData.contact_person,
          contact_email: formData.contact_email,
          service_type: validServices[0].service_description,
          frequency: validServices[0].frequency || null,
          price: calculateTotal(),
          payment_terms: formData.payment_terms,
          materials: formData.materials,
          notes: formData.notes || null,
          include_profile: formData.include_profile,
          include_client_form: formData.include_client_form,
          updated_at: new Date().toISOString()
        })
        .eq('id', proposal.id);

      if (proposalError) throw proposalError;

      // Delete old services
      await supabase
        .from('proposal_services')
        .delete()
        .eq('proposal_id', proposal.id);

      // Insert updated service lines
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

      toast.success('ההצעה עודכנה בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating proposal:', error);
      toast.error('שגיאה בעדכון ההצעה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת הצעת מחיר - {proposal.proposal_number}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_client_name">שם לקוח *</Label>
              <Input
                id="edit_client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="שם הלקוח או החברה"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_company_id">ח.פ</Label>
              <Input
                id="edit_company_id"
                value={formData.company_id}
                onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                placeholder="מספר חברה (אופציונלי)"
                dir="ltr"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_contact_person">איש קשר *</Label>
              <Input
                id="edit_contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="שם איש הקשר"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_contact_email">מייל איש קשר *</Label>
              <Input
                id="edit_contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
          </div>

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
            <Label htmlFor="edit_payment_terms">תנאי תשלום</Label>
            <Input
              id="edit_payment_terms"
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
                <RadioGroupItem value="basic" id="edit_basic" />
                <Label htmlFor="edit_basic" className="font-normal">כולל חומרי ניקיון בסיסיים בלבד</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="toiletries" id="edit_toiletries" />
                <Label htmlFor="edit_toiletries" className="font-normal">כולל חומרים ומוצרי טואלטיקה</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="none" id="edit_none" />
                <Label htmlFor="edit_none" className="font-normal">ללא חומרים כלל</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not_relevant" id="edit_not_relevant" />
                <Label htmlFor="edit_not_relevant" className="font-normal">לא רלוונטי</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit_notes">הערות</Label>
            <Textarea
              id="edit_notes"
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
              {loading ? 'מעדכן...' : 'שמור שינויים'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
