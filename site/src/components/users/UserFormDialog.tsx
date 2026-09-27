import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, UserPlus, Shield, User, Users, Edit, Building2 } from 'lucide-react';

// Convert phone to email format for Supabase Auth
const phoneToEmail = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};

const createUserSchema = z.object({
  full_name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים').max(100, 'שם ארוך מדי'),
  phone: z.string()
    .min(1, 'יש להזין מספר טלפון')
    .regex(/^05\d{8}$/, 'מספר טלפון לא תקין (נדרש פורמט 05XXXXXXXX)'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים').max(50, 'סיסמה ארוכה מדי'),
  role: z.enum(['super_admin', 'manager', 'driver', 'client']),
  driver_license_number: z.string().max(20, 'מספר רישיון ארוך מדי').optional().or(z.literal('')),
  driver_license_expiry: z.string().optional().or(z.literal('')),
});

const editUserSchema = z.object({
  full_name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים').max(100, 'שם ארוך מדי'),
  phone: z.string()
    .min(1, 'יש להזין מספר טלפון')
    .regex(/^05\d{8}$/, 'מספר טלפון לא תקין (נדרש פורמט 05XXXXXXXX)'),
  role: z.enum(['super_admin', 'manager', 'driver', 'client']),
  driver_license_number: z.string().max(20, 'מספר רישיון ארוך מדי').optional().or(z.literal('')),
  driver_license_expiry: z.string().optional().or(z.literal('')),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_license_number: string | null;
  driver_license_expiry: string | null;
  roles: { role: 'super_admin' | 'manager' | 'driver' | 'client' }[];
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedRoles?: ('super_admin' | 'manager' | 'driver' | 'client')[];
  editingUser?: UserWithRole | null;
}

const roleLabels: Record<string, string> = {
  super_admin: 'מנהל-על',
  manager: 'מנהל',
  driver: 'משתמש',
  client: 'לקוח',
};

const roleDescriptions: Record<string, string> = {
  super_admin: 'גישה מלאה לכל המערכת והגדרות',
  manager: 'ניהול מידע',
  driver: 'צפייה במידע אישי ומילוי טפסים',
  client: 'גישה לאזור הלקוחות בלבד',
};

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  super_admin: Shield,
  manager: Users,
  driver: User,
  client: Building2,
};

export const UserFormDialog = ({ open, onOpenChange, allowedRoles = ['super_admin', 'manager', 'driver', 'client'], editingUser }: UserFormDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = !!editingUser;

  const form = useForm<CreateUserFormData | EditUserFormData>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      ...(isEditing ? {} : { password: '' }),
      role: allowedRoles.includes('driver') ? 'driver' : allowedRoles[0],
      driver_license_number: '',
      driver_license_expiry: '',
    },
  });

  useEffect(() => {
    if (editingUser && open) {
      form.reset({
        full_name: editingUser.full_name || '',
        phone: editingUser.phone || '',
        role: editingUser.roles[0]?.role || 'driver',
        driver_license_number: editingUser.driver_license_number || '',
        driver_license_expiry: editingUser.driver_license_expiry || '',
      });
    } else if (!open) {
      form.reset({
        full_name: '',
        phone: '',
        ...(isEditing ? {} : { password: '' }),
        role: allowedRoles.includes('driver') ? 'driver' : allowedRoles[0],
        driver_license_number: '',
        driver_license_expiry: '',
      });
    }
  }, [editingUser, open, form, allowedRoles, isEditing]);

  const selectedRole = form.watch('role');

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const email = phoneToEmail(data.phone);
      const response = await supabase.functions.invoke('create-user', {
        body: {
          action: 'create',
          email: email,
          password: data.password,
          full_name: data.full_name,
          role: data.role,
          phone: data.phone,
          driver_license_number: data.driver_license_number || undefined,
          driver_license_expiry: data.driver_license_expiry || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message || 'שגיאה ביצירת משתמש');
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: 'משתמש נוצר בהצלחה!', description: 'המשתמש יכול כעת להתחבר למערכת' });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error('Error creating user:', error);
      toast({ title: 'שגיאה ביצירת משתמש', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditUserFormData) => {
      const email = phoneToEmail(data.phone);
      const response = await supabase.functions.invoke('create-user', {
        body: {
          action: 'update',
          user_id: editingUser?.user_id,
          email: email,
          full_name: data.full_name,
          role: data.role,
          phone: data.phone,
          driver_license_number: data.driver_license_number || undefined,
          driver_license_expiry: data.driver_license_expiry || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message || 'שגיאה בעדכון משתמש');
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: 'משתמש עודכן בהצלחה!' });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating user:', error);
      toast({ title: 'שגיאה בעדכון משתמש', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: CreateUserFormData | EditUserFormData) => {
    if (isEditing) {
      updateMutation.mutate(data as EditUserFormData);
    } else {
      createMutation.mutate(data as CreateUserFormData);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            {isEditing ? <Edit className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
            {isEditing ? 'עריכת משתמש' : 'הוספת משתמש חדש'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEditing ? 'עדכון פרטי המשתמש' : 'צור משתמש חדש במערכת עם שם משתמש וסיסמה'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Role Selection */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">סוג משתמש *</FormLabel>
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {allowedRoles.map((role) => {
                      const Icon = roleIcons[role];
                      const isSelected = field.value === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => field.onChange(role)}
                          className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-right ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                        >
                          <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{roleLabels[role]}</p>
                            <p className="text-muted-foreground">{roleDescriptions[role]}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Basic Info */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg">פרטים אישיים</h3>
              
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם מלא *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ישראל ישראלי" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>טלפון (שם משתמש) *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="05XXXXXXXX" 
                        dir="ltr" 
                        className="text-left text-lg tracking-wider"
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </FormControl>
                    <FormDescription>מספר הטלפון ישמש להתחברות למערכת</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Login Credentials */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg">פרטי התחברות</h3>
              
              <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                <p>מספר הטלפון ישמש כשם משתמש להתחברות למערכת</p>
              </div>

              {!isEditing && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סיסמה *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="לפחות 6 תווים" 
                            dir="ltr" 
                            className="text-left pl-12" 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute left-1 top-1/2 -translate-y-1/2"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>המשתמש יוכל לשנות את הסיסמה לאחר ההתחברות</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Driver license fields - available for all roles */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg">פרטי רישיון נהיגה</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="driver_license_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>מספר רישיון</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345678" dir="ltr" className="text-left" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="driver_license_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תוקף רישיון</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex gap-3 pt-6 border-t">
              <Button type="submit" disabled={isPending} className="flex-1 text-lg py-6">
                {isPending ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    {isEditing ? 'מעדכן...' : 'יוצר משתמש...'}
                  </>
                ) : (
                  <>
                    {isEditing ? <Edit className="ml-2 h-5 w-5" /> : <UserPlus className="ml-2 h-5 w-5" />}
                    {isEditing ? 'עדכן משתמש' : 'צור משתמש'}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} className="text-lg py-6">
                ביטול
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};