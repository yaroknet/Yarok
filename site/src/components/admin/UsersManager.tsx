import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { DeleteUserDialog } from '@/components/users/DeleteUserDialog';
import { ResetPasswordDialog } from '@/components/users/ResetPasswordDialog';
import { Plus, Search, Shield, Users, Car, UserCog, MoreHorizontal, Edit, Trash2, KeyRound, Download, History, LogIn, LogOut, Monitor, Smartphone, Clock, RefreshCw, Link2, Copy, XCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_license_number: string | null;
  driver_license_expiry: string | null;
  created_at: string | null;
  procurement_enabled: boolean | null;
  roles: {
    role: 'super_admin' | 'manager' | 'driver' | 'client';
  }[];
}

const roleLabels: Record<string, string> = {
  super_admin: 'מנהל-על',
  manager: 'מנהל',
  driver: 'משתמש',
  client: 'לקוח'
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  driver: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  client: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
};

export const UsersManager = () => {
  const { isSuperAdmin, isManager, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'manager' | 'driver'>('all');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ userId: string; userName: string } | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<{ userId: string; userName: string } | null>(null);
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [sessionFilterStatus, setSessionFilterStatus] = useState<'all' | 'active' | 'ended'>('all');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = profiles.map(profile => ({
        ...profile,
        roles: roles.filter(r => r.user_id === profile.user_id).map(r => ({ role: r.role }))
      }));
      return usersWithRoles;
    }
  });

  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['session-logs'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('session_logs')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set(logs?.map(l => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
      return logs?.map(log => ({
        ...log,
        profile: profileMap.get(log.user_id)
      }));
    },
    enabled: isManager
  });

  const filteredUsers = users?.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm);
    const matchesRole = roleFilter === 'all' || u.roles.some(r => r.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  const filteredSessions = sessions?.filter(session => {
    const matchesSearch = session.profile?.full_name?.toLowerCase().includes(sessionSearchTerm.toLowerCase()) ||
      session.profile?.email?.toLowerCase().includes(sessionSearchTerm.toLowerCase());
    const matchesStatus = sessionFilterStatus === 'all' ||
      (sessionFilterStatus === 'active' && !session.logout_at) ||
      (sessionFilterStatus === 'ended' && session.logout_at);
    return matchesSearch && matchesStatus;
  }) || [];

  const activeSessionsCount = sessions?.filter(s => !s.logout_at).length || 0;

  const stats = {
    total: users?.length || 0,
    superAdmins: users?.filter(u => u.roles.some(r => r.role === 'super_admin')).length || 0,
    managers: users?.filter(u => u.roles.some(r => r.role === 'manager')).length || 0,
    drivers: users?.filter(u => u.roles.some(r => r.role === 'driver')).length || 0
  };

  const allowedRoles: ('super_admin' | 'manager' | 'driver' | 'client')[] = isSuperAdmin ? ['super_admin', 'manager', 'driver', 'client'] : ['driver'];

  const handleEditUser = (userToEdit: UserWithRole) => {
    setEditingUser(userToEdit);
    setFormDialogOpen(true);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setUserToDelete({ userId, userName });
    setDeleteDialogOpen(true);
  };

  const handleResetPassword = (userId: string, userName: string) => {
    setUserToResetPassword({ userId, userName });
    setResetPasswordOpen(true);
  };

  const queryClient = useQueryClient();

  const buildPublicOrderUrl = () => {
    let origin = window.location.origin;
    try {
      if (window.top && window.top.location && window.top.location.origin) {
        origin = window.top.location.origin;
      }
    } catch { /* cross-origin iframe */ }
    if (/lovableproject\.com|lovable\.app|localhost|127\.0\.0\.1/i.test(origin)) {
      origin = 'https://yaroknet.co.il';
    }
    return `${origin}/purchase-order-form`;
  };


  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fallthrough */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const copyPublicOrderLink = async () => {
    const url = buildPublicOrderUrl();
    const ok = await copyToClipboard(url);
    if (ok) toast.success('קישור ההזמנות הציבורי הועתק ללוח');
    else toast.error('העתקה נכשלה — העתק ידנית: ' + url);
  };

  const toggleProcurementEnabled = async (u: UserWithRole) => {
    const next = !u.procurement_enabled;
    const { error } = await supabase
      .from('profiles')
      .update({ procurement_enabled: next })
      .eq('user_id', u.user_id);
    if (error) {
      toast.error('שגיאה בעדכון הרשאת הזמנות רכש');
      return;
    }
    toast.success(next ? 'המשתמש הוגדר כמבצע הזמנות רכש' : 'הוסרה הרשאת ביצוע הזמנות רכש');
    await queryClient.invalidateQueries({ queryKey: ['users'] });
  };


  const canManageUser = (targetUser: UserWithRole) => {
    if (isSuperAdmin) return true;
    if (isManager) {
      if (targetUser.user_id === user?.id) return false;
      return targetUser.roles.every(r => r.role === 'driver');
    }
    return false;
  };

  const exportToExcel = () => {
    if (!filteredUsers?.length) {
      toast.error('אין נתונים לייצוא');
      return;
    }
    const headers = ['שם מלא', 'אימייל', 'טלפון', 'תפקיד', 'רישיון נהיגה', 'תוקף רישיון', 'תאריך הצטרפות'];
    const rows = filteredUsers.map(u => [
      u.full_name,
      u.email || '',
      u.phone || '',
      u.roles.map(r => roleLabels[r.role]).join(', ') || 'ללא תפקיד',
      u.driver_license_number || '',
      u.driver_license_expiry ? format(new Date(u.driver_license_expiry), 'dd/MM/yyyy') : '',
      u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy') : ''
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('הקובץ יוצא בהצלחה');
  };

  const handleFormDialogClose = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setEditingUser(null);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    return isMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  };

  const getDeviceType = (userAgent: string | null) => {
    if (!userAgent) return 'לא ידוע';
    if (/iphone|ipad/i.test(userAgent)) return 'iOS';
    if (/android/i.test(userAgent)) return 'Android';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/mac/i.test(userAgent)) return 'Mac';
    if (/linux/i.test(userAgent)) return 'Linux';
    return 'אחר';
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            משתמשים
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <History className="h-4 w-4" />
            היסטוריית התחברויות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-6">
          <div className="flex flex-wrap gap-2 items-center justify-start">
            <Button onClick={exportToExcel} variant="outline" size="default">
              <Download className="h-4 w-4 ml-2" />
              ייצוא Excel
            </Button>
            <Button onClick={() => setFormDialogOpen(true)} size="default">
              <Plus className="h-4 w-4 ml-2" />
              הוסף משתמש
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">סה"כ משתמשים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{stats.total}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">מנהלי-על</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-purple-500" />
                  <span className="text-3xl font-bold">{stats.superAdmins}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">מנהלים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <span className="text-3xl font-bold">{stats.managers}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">נהגים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Car className="h-8 w-8 text-green-500" />
                  <span className="text-3xl font-bold">{stats.drivers}</span>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש לפי שם, אימייל או טלפון..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pr-12"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={roleFilter === 'all' ? 'default' : 'outline'} onClick={() => setRoleFilter('all')}>
                    הכל
                  </Button>
                  <Button variant={roleFilter === 'super_admin' ? 'default' : 'outline'} onClick={() => setRoleFilter('super_admin')}>
                    <Shield className="h-4 w-4 ml-2" />
                    מנהלי-על
                  </Button>
                  <Button variant={roleFilter === 'manager' ? 'default' : 'outline'} onClick={() => setRoleFilter('manager')}>
                    <Users className="h-4 w-4 ml-2" />
                    מנהלים
                  </Button>
                  <Button variant={roleFilter === 'driver' ? 'default' : 'outline'} onClick={() => setRoleFilter('driver')}>
                    <Car className="h-4 w-4 ml-2" />
                    נהגים
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם מלא</TableHead>
                    <TableHead className="text-right">אימייל</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">תפקיד</TableHead>
                    <TableHead className="text-right">תאריך הצטרפות</TableHead>
                    <TableHead className="text-right w-[80px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        לא נמצאו משתמשים
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers?.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell dir="ltr" className="text-left">{u.email || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-left">{u.phone || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {u.roles.map((r, idx) => (
                              <Badge key={idx} className={roleColors[r.role]}>
                                {roleLabels[r.role]}
                              </Badge>
                            ))}
                            {u.roles.length === 0 && <Badge variant="outline">ללא תפקיד</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy', { locale: he }) : '-'}
                        </TableCell>
                        <TableCell>
                          {canManageUser(u) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditUser(u)}>
                                  <Edit className="h-4 w-4 ml-2" />
                                  עריכה
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResetPassword(u.user_id, u.full_name)}>
                                  <KeyRound className="h-4 w-4 ml-2" />
                                  איפוס סיסמה
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleProcurementEnabled(u)}>
                                  {u.procurement_enabled ? (
                                    <><XCircle className="h-4 w-4 ml-2" /> בטל הרשאת הזמנות רכש</>
                                  ) : (
                                    <><ShoppingCart className="h-4 w-4 ml-2" /> אפשר ביצוע הזמנות רכש</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteUser(u.user_id, u.full_name)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 ml-2" />
                                  מחיקה
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => refetchSessions()}>
              <RefreshCw className="h-4 w-4 ml-2" />
              רענן
            </Button>
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <Users className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeSessionsCount}</p>
                    <p className="text-sm text-muted-foreground">מחוברים כעת</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <LogIn className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">סה"כ התחברויות</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sessions?.filter(s => s.logout_at).length || 0}</p>
                    <p className="text-sm text-muted-foreground">התנתקויות</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש לפי שם או אימייל..."
                    value={sessionSearchTerm}
                    onChange={e => setSessionSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={sessionFilterStatus} onValueChange={v => setSessionFilterStatus(v as 'all' | 'active' | 'ended')}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="active">מחוברים</SelectItem>
                    <SelectItem value="ended">התנתקו</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Sessions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">רשימת התחברויות</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>לא נמצאו התחברויות</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">משתמש</TableHead>
                        <TableHead className="text-right">כניסה</TableHead>
                        <TableHead className="text-right">יציאה</TableHead>
                        <TableHead className="text-right">משך</TableHead>
                        <TableHead className="text-right">מכשיר</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map(session => {
                        const loginDate = new Date(session.login_at);
                        const logoutDate = session.logout_at ? new Date(session.logout_at) : null;
                        const duration = logoutDate ? Math.round((logoutDate.getTime() - loginDate.getTime()) / 1000 / 60) : null;
                        return (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{session.profile?.full_name || 'לא ידוע'}</p>
                                <p className="text-sm text-muted-foreground">{session.profile?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{format(loginDate, 'dd/MM/yyyy', { locale: he })}</p>
                                <p className="text-sm text-muted-foreground">{format(loginDate, 'HH:mm')}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {logoutDate ? (
                                <div>
                                  <p>{format(logoutDate, 'dd/MM/yyyy', { locale: he })}</p>
                                  <p className="text-sm text-muted-foreground">{format(logoutDate, 'HH:mm')}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {duration !== null ? (
                                <span>{duration} דק׳</span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(loginDate, { locale: he, addSuffix: false })}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(session.user_agent)}
                                <span className="text-sm">{getDeviceType(session.user_agent)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {session.logout_at ? (
                                <Badge variant="secondary" className="gap-1">
                                  <LogOut className="h-3 w-3" />
                                  התנתק
                                </Badge>
                              ) : (
                                <Badge variant="default" className="gap-1 bg-green-500">
                                  <LogIn className="h-3 w-3" />
                                  מחובר
                                </Badge>
                              )}
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
        </TabsContent>
      </Tabs>

      <UserFormDialog
        open={formDialogOpen}
        onOpenChange={handleFormDialogClose}
        allowedRoles={allowedRoles}
        editingUser={editingUser}
      />

      {userToDelete && (
        <DeleteUserDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          userId={userToDelete.userId}
          userName={userToDelete.userName}
        />
      )}

      {userToResetPassword && (
        <ResetPasswordDialog
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
          userId={userToResetPassword.userId}
          userName={userToResetPassword.userName}
        />
      )}

    </div>
  );
};
