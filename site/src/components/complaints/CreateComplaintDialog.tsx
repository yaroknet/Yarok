import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, X, FileText, Image, File, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Manager {
  user_id: string;
  full_name: string;
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

export function CreateComplaintDialog({ open, onOpenChange, onSuccess }: CreateComplaintDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [clientOpen, setClientOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_person: '',
    branch_name: '',
    manager_id: '',
    complaint_description: '',
    incident_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchManagers();
      fetchClients();
      fetchBranches();
    }
  }, [open]);

  const fetchManagers = async () => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['manager', 'super_admin']);

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;
        setManagers(profiles || []);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, client_id')
        .order('name');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(formData.customer_name.toLowerCase())
  );

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(formData.branch_name.toLowerCase())
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const selectedManager = managers.find(m => m.user_id === formData.manager_id);

    setLoading(true);
    try {
      const { data: complaintData, error } = await supabase
        .from('complaints')
        .insert({
          customer_name: formData.customer_name || 'לא צוין',
          customer_phone: formData.contact_person || '', // Using contact_person in customer_phone field
          branch_name: formData.branch_name || 'לא צוין',
          city: '', // Empty since we removed city
          manager_id: formData.manager_id || user.id,
          manager_name: selectedManager?.full_name || 'לא צוין',
          complaint_description: formData.complaint_description || 'לא צוין',
          incident_date: formData.incident_date,
          notes: formData.notes,
          created_by: user.id,
          history_log: [{
            action: 'created',
            timestamp: new Date().toISOString(),
            user_id: user.id,
            details: 'תלונה נוצרה'
          }]
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files if any
      if (files.length > 0 && complaintData) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${complaintData.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('complaint-attachments')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('complaint-attachments')
            .getPublicUrl(fileName);

          await supabase
            .from('complaint_attachments')
            .insert({
              complaint_id: complaintData.id,
              file_name: file.name,
              file_url: publicUrl,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: user.id
            });
        }
      }

      // Send push notification to the manager if one was selected
      if (formData.manager_id) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              title: '⚠️ תלונה חדשה התקבלה',
              body: `תלונה חדשה מלקוח ${formData.customer_name || 'לא צוין'} - ${formData.branch_name || 'לא צוין'}`,
              targetUserId: formData.manager_id,
              data: {
                type: 'complaint',
                complaintId: complaintData.id,
                url: '/complaints'
              }
            }
          });
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
        }
      }

      toast.success('התלונה נוספה בהצלחה');
      onSuccess();
      onOpenChange(false);
      setFormData({
        customer_name: '',
        contact_person: '',
        branch_name: '',
        manager_id: '',
        complaint_description: '',
        incident_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setFiles([]);
    } catch (error: any) {
      console.error('Error creating complaint:', error);
      toast.error('שגיאה ביצירת התלונה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>תלונה חדשה</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name with Autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="customer_name">שם לקוח</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, customer_name: e.target.value }));
                        if (e.target.value.length > 0) {
                          setClientOpen(true);
                        }
                      }}
                      onFocus={() => {
                        if (formData.customer_name.length > 0 || clients.length > 0) {
                          setClientOpen(true);
                        }
                      }}
                      placeholder="הקלד שם לקוח"
                      className="pr-8"
                    />
                    <ChevronsUpDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.slice(0, 10).map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => {
                              setFormData(prev => ({ ...prev, customer_name: client.name }));
                              setClientOpen(false);
                            }}
                          >
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Contact Person */}
            <div className="space-y-2">
              <Label htmlFor="contact_person">איש קשר</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="הזן שם איש קשר"
              />
            </div>
            
            {/* Branch with Autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="branch_name">סניף</Label>
              <Popover open={branchOpen} onOpenChange={setBranchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      id="branch_name"
                      value={formData.branch_name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, branch_name: e.target.value }));
                        if (e.target.value.length > 0) {
                          setBranchOpen(true);
                        }
                      }}
                      onFocus={() => {
                        if (formData.branch_name.length > 0 || branches.length > 0) {
                          setBranchOpen(true);
                        }
                      }}
                      placeholder="הקלד שם סניף"
                      className="pr-8"
                    />
                    <ChevronsUpDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandEmpty>לא נמצאו סניפים</CommandEmpty>
                      <CommandGroup>
                        {filteredBranches.slice(0, 10).map((branch) => (
                          <CommandItem
                            key={branch.id}
                            value={branch.name}
                            onSelect={() => {
                              setFormData(prev => ({ ...prev, branch_name: branch.name }));
                              setBranchOpen(false);
                            }}
                          >
                            {branch.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manager_id">מנהל אחראי</Label>
              <Select 
                value={formData.manager_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, manager_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מנהל" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.user_id} value={manager.user_id}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="incident_date">תאריך אירוע</Label>
              <Input
                id="incident_date"
                type="date"
                value={formData.incident_date}
                onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="complaint_description">תיאור התלונה</Label>
            <Textarea
              id="complaint_description"
              value={formData.complaint_description}
              onChange={(e) => setFormData(prev => ({ ...prev, complaint_description: e.target.value }))}
              placeholder="תאר את התלונה בפירוט"
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">הערות פנימיות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="הערות לשימוש פנימי"
              rows={2}
            />
          </div>

          {/* File Upload Section */}
          <div className="space-y-2">
            <Label>קבצים מצורפים</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 ml-2" />
              בחר קבצים להעלאה
            </Button>
            
            {files.length > 0 && (
              <div className="space-y-2 mt-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.type)}
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'שומר...' : 'שמור תלונה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
