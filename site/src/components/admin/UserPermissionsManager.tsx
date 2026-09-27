import { useEffect, useState } from 'react';
import { Save, Loader2, Search, User, Mail, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface Module {
  id: string;
  name: string;
  display_name: string;
}

interface ModulePermission {
  id?: string;
  user_id: string;
  module_id: string;
  has_access: boolean;
  data_scope: string;
}

type DataScope = 'personal' | 'team' | 'global';

export const UserPermissionsManager = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, rolesRes, modulesRes, permissionsRes] = await Promise.all([
        supabase.from('profiles').select('id, user_id, full_name, email, phone'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('modules').select('id, name, display_name').eq('is_active', true),
        supabase.from('user_module_permissions').select('*'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (modulesRes.error) throw modulesRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      setProfiles(profilesRes.data || []);
      setUserRoles(rolesRes.data || []);
      setModules(modulesRes.data || []);
      setPermissions(permissionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (userId: string): string => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'driver';
  };

  const getUserPermission = (userId: string, moduleId: string): ModulePermission | undefined => {
    return permissions.find(p => p.user_id === userId && p.module_id === moduleId);
  };

  const handlePermissionChange = async (
    userId: string,
    moduleId: string,
    field: 'has_access' | 'data_scope',
    value: boolean | DataScope
  ) => {
    setSaving(userId);

    try {
      const existingPermission = getUserPermission(userId, moduleId);

      if (existingPermission?.id) {
        // Update existing permission
        const { error } = await supabase
          .from('user_module_permissions')
          .update({ [field]: value })
          .eq('id', existingPermission.id);

        if (error) throw error;

        setPermissions(prev =>
          prev.map(p =>
            p.id === existingPermission.id ? { ...p, [field]: value } : p
          )
        );
      } else {
        // Create new permission
        const newPermission = {
          user_id: userId,
          module_id: moduleId,
          has_access: field === 'has_access' ? value as boolean : false,
          data_scope: field === 'data_scope' ? value as DataScope : 'personal',
        };

        const { data, error } = await supabase
          .from('user_module_permissions')
          .insert(newPermission)
          .select()
          .single();

        if (error) throw error;

        setPermissions(prev => [...prev, data]);
      }

      toast.success('ההרשאות עודכנו בהצלחה');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('שגיאה בעדכון ההרשאות');
    } finally {
      setSaving(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'manager':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'מנהל ראשי';
      case 'manager':
        return 'מנהל';
      default:
        return 'נהג';
    }
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'personal':
        return 'אישי';
      case 'team':
        return 'צוות';
      case 'global':
        return 'גלובלי';
      default:
        return scope;
    }
  };

  const filteredProfiles = profiles.filter(
    p =>
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ניהול הרשאות משתמשים
          </CardTitle>
          <CardDescription>
            הגדר הרשאות גישה ורמת נראות נתונים לכל משתמש בכל מודול
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חפש לפי שם, אימייל או טלפון..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Users List */}
          <div className="space-y-4">
            {filteredProfiles.map(profile => {
              const role = getUserRole(profile.user_id);
              const isSuperAdmin = role === 'super_admin';

              return (
                <Card key={profile.id} className="overflow-hidden">
                  <div className="p-4 bg-muted/30 border-b border-border">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{profile.full_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {profile.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {profile.email}
                              </span>
                            )}
                            {profile.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {profile.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={getRoleBadgeVariant(role)}>
                        {getRoleLabel(role)}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4">
                    {isSuperAdmin ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        למנהל ראשי יש גישה מלאה לכל המודולים
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {modules.map(module => {
                          const permission = getUserPermission(profile.user_id, module.id);
                          const hasAccess = permission?.has_access || false;
                          const dataScope = (permission?.data_scope || 'personal') as DataScope;

                          return (
                            <div
                              key={module.id}
                              className="flex items-center justify-between flex-wrap gap-4 p-3 rounded-lg bg-muted/20"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{module.display_name}</span>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`access-${profile.id}-${module.id}`} className="text-sm">
                                    גישה
                                  </Label>
                                  <Switch
                                    id={`access-${profile.id}-${module.id}`}
                                    checked={hasAccess}
                                    onCheckedChange={checked =>
                                      handlePermissionChange(profile.user_id, module.id, 'has_access', checked)
                                    }
                                    disabled={saving === profile.user_id}
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">טווח נתונים</Label>
                                  <Select
                                    value={dataScope}
                                    onValueChange={(value: DataScope) =>
                                      handlePermissionChange(profile.user_id, module.id, 'data_scope', value)
                                    }
                                    disabled={saving === profile.user_id || !hasAccess}
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="personal">אישי</SelectItem>
                                      <SelectItem value="team">צוות</SelectItem>
                                      <SelectItem value="global">גלובלי</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}

            {filteredProfiles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                לא נמצאו משתמשים
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
