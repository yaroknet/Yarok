import { useState, useEffect, useMemo } from 'react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  client_id: string;
  name: string;
}

interface User {
  id: string;
  user_id: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSuccess: () => void;
}

const JOB_TYPES = [
  { value: 'start_work', label: 'תחילת עבודה' },
  { value: 'standard_change', label: 'שינוי תקן' },
  { value: 'end_service', label: 'סיום שירות' },
  { value: 'storefronts', label: 'ויטרינות' },
  { value: 'high_cleaning', label: 'ניקיון גובה' },
  { value: 'employee_supply', label: 'אספקת עובד' },
  { value: 'other', label: 'אחר' },
];

const EMPLOYEE_TYPES = [
  { value: 'cleaner', label: 'מנקה' },
  { value: 'porter', label: 'סבל' },
];

const FREQUENCY_OPTIONS = [
  { value: 'one_time', label: 'חד פעמי' },
  { value: 'daily', label: 'יומי' },
  { value: 'weekly', label: 'שבועי' },
  { value: 'bi_weekly', label: 'דו-שבועי' },
  { value: 'monthly', label: 'חודשי' },
];

export const CreateFieldTaskDialog = ({ open, onOpenChange, clients, onSuccess }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  
  // Client autocomplete state
  const [clientInput, setClientInput] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Branch autocomplete state
  const [branchInput, setBranchInput] = useState('');
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    assigned_to: '',
    title: '',
    description: '',
    job_type: 'start_work',
    address: '',
    frequency: 'one_time',
    deadline: null as Date | null,
    special_notes: '',
    requires_media: false,
    recurring_count: 4,
    // Employee supply specific fields
    employee_type: '' as string,
    worker_count: 1,
    manager_count: 0,
    // Other job type
    other_description: '',
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchAllBranches();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAllBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, client_id, name')
        .order('name');

      if (error) throw error;
      setAllBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  // Filter clients based on input
  const filteredClients = useMemo(() => {
    if (!clientInput.trim()) return clients;
    const lowerInput = clientInput.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(lowerInput));
  }, [clients, clientInput]);

  // Filter branches based on input and selected client
  const filteredBranches = useMemo(() => {
    let branchesToFilter = allBranches;
    
    // If a client is selected, filter by client
    if (selectedClientId) {
      branchesToFilter = allBranches.filter(b => b.client_id === selectedClientId);
    }
    
    if (!branchInput.trim()) return branchesToFilter;
    const lowerInput = branchInput.toLowerCase();
    return branchesToFilter.filter(b => b.name.toLowerCase().includes(lowerInput));
  }, [allBranches, branchInput, selectedClientId]);

  const generateRecurringDates = (startDate: Date, frequency: string, count: number): Date[] => {
    const dates: Date[] = [startDate];
    
    for (let i = 1; i < count; i++) {
      let nextDate: Date;
      switch (frequency) {
        case 'daily':
          nextDate = addDays(startDate, i);
          break;
        case 'weekly':
          nextDate = addWeeks(startDate, i);
          break;
        case 'bi_weekly':
          nextDate = addWeeks(startDate, i * 2);
          break;
        case 'monthly':
          nextDate = addMonths(startDate, i);
          break;
        default:
          return dates;
      }
      dates.push(nextDate);
    }
    
    return dates;
  };

  const buildJobTypeDescription = (): string => {
    if (formData.job_type === 'employee_supply') {
      const typeLabel = EMPLOYEE_TYPES.find(t => t.value === formData.employee_type)?.label || formData.employee_type;
      let desc = `אספקת עובד - ${typeLabel}`;
      if (formData.worker_count > 0) desc += `, ${formData.worker_count} עובדים`;
      if (formData.manager_count > 0) desc += `, ${formData.manager_count} מנהלים`;
      return desc;
    }
    if (formData.job_type === 'other') {
      return `אחר - ${formData.other_description}`;
    }
    return formData.job_type;
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('כותרת המשימה היא שדה חובה');
      return;
    }
    if (!formData.assigned_to) {
      toast.error('יש לבחור עובד מוקצה');
      return;
    }
    if (!user) {
      toast.error('שגיאה בזיהוי המשתמש');
      return;
    }
    if (formData.job_type === 'employee_supply' && !formData.employee_type) {
      toast.error('יש לבחור סוג עובד');
      return;
    }
    if (formData.job_type === 'other' && !formData.other_description.trim()) {
      toast.error('יש למלא תיאור לסוג עבודה אחר');
      return;
    }

    setLoading(true);
    try {
      const jobTypeForDb = buildJobTypeDescription();
      
      const baseTask = {
        client_id: selectedClientId || null,
        branch_id: selectedBranchId || null,
        assigned_to: formData.assigned_to,
        assigned_by: user.id,
        title: formData.title,
        description: formData.description || null,
        job_type: jobTypeForDb,
        address: formData.address || null,
        frequency: formData.frequency,
        special_notes: formData.special_notes || null,
        requires_media: formData.requires_media,
        status: 'pending',
      };

      if (formData.frequency === 'one_time') {
        const { error } = await supabase
          .from('field_tasks')
          .insert({
            ...baseTask,
            deadline: formData.deadline ? format(formData.deadline, 'yyyy-MM-dd') : null,
          });

        if (error) throw error;
        toast.success('המשימה נוצרה בהצלחה');
      } else {
        if (!formData.deadline) {
          toast.error('יש לבחור תאריך התחלה למשימות חוזרות');
          setLoading(false);
          return;
        }

        const dates = generateRecurringDates(formData.deadline, formData.frequency, formData.recurring_count);
        
        const { data: parentTask, error: parentError } = await supabase
          .from('field_tasks')
          .insert({
            ...baseTask,
            deadline: format(dates[0], 'yyyy-MM-dd'),
          })
          .select()
          .single();

        if (parentError) throw parentError;

        if (dates.length > 1) {
          const childTasks = dates.slice(1).map(date => ({
            ...baseTask,
            deadline: format(date, 'yyyy-MM-dd'),
            recurring_parent_id: parentTask.id,
          }));

          const { error: childError } = await supabase
            .from('field_tasks')
            .insert(childTasks);

          if (childError) throw childError;
        }

        toast.success(`נוצרו ${dates.length} משימות בהצלחה`);
      }

      // Reset form
      setFormData({
        assigned_to: '',
        title: '',
        description: '',
        job_type: 'start_work',
        address: '',
        frequency: 'one_time',
        deadline: null,
        special_notes: '',
        requires_media: false,
        recurring_count: 4,
        employee_type: '',
        worker_count: 1,
        manager_count: 0,
        other_description: '',
      });
      setClientInput('');
      setBranchInput('');
      setSelectedClientId(null);
      setSelectedBranchId(null);
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('שגיאה ביצירת המשימה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">כותרת *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="תיאור קצר של המשימה"
            />
          </div>

          {/* Client & Branch with Autocomplete */}
          <div className="grid grid-cols-2 gap-4">
            {/* Client Autocomplete */}
            <div>
              <Label>לקוח</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPopoverOpen}
                    className="w-full justify-between text-right"
                  >
                    <span className="truncate">
                      {selectedClientId 
                        ? clients.find(c => c.id === selectedClientId)?.name 
                        : clientInput || "בחר או הקלד לקוח"}
                    </span>
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="חפש או הקלד לקוח..." 
                      value={clientInput}
                      onValueChange={(value) => {
                        setClientInput(value);
                        // If typing something new, clear the selection
                        if (selectedClientId) {
                          const selectedClient = clients.find(c => c.id === selectedClientId);
                          if (selectedClient && value !== selectedClient.name) {
                            setSelectedClientId(null);
                            setSelectedBranchId(null);
                            setBranchInput('');
                          }
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {clientInput.trim() && (
                          <div className="p-2 text-sm text-muted-foreground">
                            ייעשה שימוש ב: "{clientInput}"
                          </div>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => {
                              setSelectedClientId(client.id);
                              setClientInput(client.name);
                              setClientPopoverOpen(false);
                              // Reset branch when client changes
                              setSelectedBranchId(null);
                              setBranchInput('');
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                selectedClientId === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Branch Autocomplete */}
            <div>
              <Label>סניף</Label>
              <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={branchPopoverOpen}
                    className="w-full justify-between text-right"
                  >
                    <span className="truncate">
                      {selectedBranchId 
                        ? allBranches.find(b => b.id === selectedBranchId)?.name 
                        : branchInput || "בחר או הקלד סניף"}
                    </span>
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="חפש או הקלד סניף..." 
                      value={branchInput}
                      onValueChange={(value) => {
                        setBranchInput(value);
                        if (selectedBranchId) {
                          const selectedBranch = allBranches.find(b => b.id === selectedBranchId);
                          if (selectedBranch && value !== selectedBranch.name) {
                            setSelectedBranchId(null);
                          }
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {branchInput.trim() && (
                          <div className="p-2 text-sm text-muted-foreground">
                            ייעשה שימוש ב: "{branchInput}"
                          </div>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredBranches.map((branch) => (
                          <CommandItem
                            key={branch.id}
                            value={branch.name}
                            onSelect={() => {
                              setSelectedBranchId(branch.id);
                              setBranchInput(branch.name);
                              setBranchPopoverOpen(false);
                              // Auto-select client if branch has one and no client selected
                              if (!selectedClientId && branch.client_id) {
                                const client = clients.find(c => c.id === branch.client_id);
                                if (client) {
                                  setSelectedClientId(client.id);
                                  setClientInput(client.name);
                                }
                              }
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                selectedBranchId === branch.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {branch.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Job Type & Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>סוג עבודה</Label>
              <Select
                value={formData.job_type}
                onValueChange={(value) => setFormData({ ...formData, job_type: value, employee_type: '', other_description: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>עובד מוקצה *</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר עובד" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Employee Supply Options */}
          {formData.job_type === 'employee_supply' && (
            <div className="space-y-3 p-3 bg-accent/30 rounded-lg">
              <div>
                <Label>סוג עובד *</Label>
                <Select
                  value={formData.employee_type}
                  onValueChange={(value) => setFormData({ ...formData, employee_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג עובד" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="worker_count">כמות עובדים</Label>
                  <Input
                    id="worker_count"
                    type="number"
                    min={0}
                    value={formData.worker_count}
                    onChange={(e) => setFormData({ ...formData, worker_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="manager_count">כמות מנהלים</Label>
                  <Input
                    id="manager_count"
                    type="number"
                    min={0}
                    value={formData.manager_count}
                    onChange={(e) => setFormData({ ...formData, manager_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Other Job Type Description */}
          {formData.job_type === 'other' && (
            <div>
              <Label htmlFor="other_description">תיאור סוג העבודה *</Label>
              <Input
                id="other_description"
                value={formData.other_description}
                onChange={(e) => setFormData({ ...formData, other_description: e.target.value })}
                placeholder="פרט במה מדובר..."
              />
            </div>
          )}

          {/* Address */}
          <div>
            <Label htmlFor="address">כתובת</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="כתובת ביצוע העבודה"
            />
          </div>

          {/* Frequency & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תדירות</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{formData.frequency === 'one_time' ? 'תאריך יעד' : 'תאריך התחלה'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right",
                      !formData.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.deadline ? format(formData.deadline, 'dd/MM/yyyy') : 'בחר תאריך'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.deadline || undefined}
                    onSelect={(date) => setFormData({ ...formData, deadline: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Recurring Count */}
          {formData.frequency !== 'one_time' && (
            <div>
              <Label htmlFor="recurring_count">מספר חזרות</Label>
              <Input
                id="recurring_count"
                type="number"
                min={2}
                max={52}
                value={formData.recurring_count}
                onChange={(e) => setFormData({ ...formData, recurring_count: parseInt(e.target.value) || 4 })}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="פרטים נוספים על המשימה..."
              rows={2}
            />
          </div>

          {/* Special Notes */}
          <div>
            <Label htmlFor="special_notes">הנחיות מיוחדות</Label>
            <Textarea
              id="special_notes"
              value={formData.special_notes}
              onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })}
              placeholder="הנחיות קריטיות שהעובד חייב לאשר..."
              rows={2}
              className="border-destructive/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              העובד יידרש לאשר קריאה לפני השלמת המשימה
            </p>
          </div>

          {/* Requires Media */}
          <div className="flex items-center gap-3">
            <Switch
              id="requires_media"
              checked={formData.requires_media}
              onCheckedChange={(checked) => setFormData({ ...formData, requires_media: checked })}
            />
            <Label htmlFor="requires_media">דרוש צילום להשלמת המשימה</Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'יוצר...' : 'צור משימה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
