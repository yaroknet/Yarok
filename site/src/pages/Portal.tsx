import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Settings, User, ClipboardList, Users, Wallet, ShoppingCart, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PulsingDot } from '@/components/ui/pulsing-dot';
import { useModuleUpdates } from '@/hooks/useModuleUpdates';

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  route: string;
}

interface ModulePermission {
  module_id: string;
  has_access: boolean;
  data_scope: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Car: Car,
  Settings: Settings,
  ClipboardList: ClipboardList,
  Users: Users,
  Wallet: Wallet,
  ShoppingCart: ShoppingCart,
  Package: Package,
};

// Map module names to the hook's module names
const moduleNameMap: Record<string, string> = {
  'fleet_management': 'fleet',
  'crm': 'crm',
  'field_journal': 'field',
  'procurement': 'procurement',
  'logistics': 'logistics',
  'admin': 'admin',
};

const Portal = () => {
  const navigate = useNavigate();
  const { user, userRole, signOut } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasModuleUpdates, markModuleAsViewed, loading: updatesLoading } = useModuleUpdates();

  useEffect(() => {
    const fetchModulesAndPermissions = async () => {
      if (!user) return;

      try {
        // Fetch active modules
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (modulesError) throw modulesError;

        // Fetch user permissions
        const { data: permissionsData, error: permissionsError } = await supabase
          .from('user_module_permissions')
          .select('module_id, has_access, data_scope')
          .eq('user_id', user.id);

        if (permissionsError) throw permissionsError;

        setModules(modulesData || []);
        setPermissions(permissionsData || []);
      } catch (error) {
        console.error('Error fetching modules:', error);
        toast.error('שגיאה בטעינת המודולים');
      } finally {
        setLoading(false);
      }
    };

    fetchModulesAndPermissions();
  }, [user]);

  const handleModuleClick = async (module: Module) => {
    const permission = permissions.find(p => p.module_id === module.id);
    const hasAccess = permission?.has_access || userRole === 'super_admin';

    if (!hasAccess) {
      toast.error('אין לך הרשאה לגשת למודול זה');
      return;
    }

    // Mark module as viewed
    const hookModuleName = moduleNameMap[module.name];
    if (hookModuleName) {
      await markModuleAsViewed(hookModuleName);
    }

    navigate(module.route);
  };

  const getModuleIcon = (iconName: string | null) => {
    if (!iconName || !iconMap[iconName]) return Car;
    return iconMap[iconName];
  };

  const hasModuleAccess = (moduleId: string) => {
    if (userRole === 'super_admin') return true;
    const permission = permissions.find(p => p.module_id === moduleId);
    return permission?.has_access || false;
  };

  const checkModuleHasUpdates = (moduleName: string): boolean => {
    const hookModuleName = moduleNameMap[moduleName];
    if (!hookModuleName) return false;
    return hasModuleUpdates(hookModuleName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show modules directly without intermediate screen
  return (
    <div className="min-h-full">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-accent/50 px-4 py-2 rounded-full mb-4">
            <User className="h-4 w-4 text-accent-foreground" />
            <span className="text-sm text-accent-foreground">שלום, {user?.email?.split('@')[0]}</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">ברוכים הבאים לאזור האישי</h2>
          <p className="text-muted-foreground">בחר את המודול שברצונך לגשת אליו</p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {modules.map((module) => {
            const IconComponent = getModuleIcon(module.icon);
            const hasAccess = hasModuleAccess(module.id);
            const hasUpdates = checkModuleHasUpdates(module.name);

            return (
              <Card
                key={module.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] relative ${
                  hasAccess 
                    ? 'bg-card/90 hover:bg-card' 
                    : 'bg-muted/50 opacity-60 cursor-not-allowed'
                }`}
                onClick={() => hasAccess && handleModuleClick(module)}
              >
                {/* Pulsing update indicator */}
                {hasAccess && hasUpdates && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <PulsingDot size="lg" color="destructive" />
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-3 ${
                    hasAccess ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <IconComponent className={`h-8 w-8 ${
                      hasAccess ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <CardTitle className="text-lg">{module.display_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center pt-0">
                  <CardDescription className="text-sm">
                    {module.description || 'לחץ לכניסה'}
                  </CardDescription>
                  {!hasAccess && (
                    <p className="text-xs text-destructive mt-2">אין הרשאת גישה</p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {modules.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">לא נמצאו מודולים זמינים</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} ירוק אחזקה, ניקיון ושירותי כוח אדם בע"מ. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
};

export default Portal;
