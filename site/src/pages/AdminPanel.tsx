import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Shield, Building2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UsersManager } from '@/components/admin/UsersManager';
import { UserPermissionsManager } from '@/components/admin/UserPermissionsManager';
import { TeamsManager } from '@/components/admin/TeamsManager';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  useEffect(() => {
    if (userRole !== 'super_admin') {
      toast.error('אין לך הרשאה לגשת לדף זה');
      navigate('/');
    }
  }, [userRole, navigate]);

  if (userRole !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background/40">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לפורטל
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">ניהול מערכת</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              משתמשים
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Settings className="h-4 w-4" />
              הרשאות
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Building2 className="h-4 w-4" />
              צוותים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManager />
          </TabsContent>

          <TabsContent value="permissions">
            <UserPermissionsManager />
          </TabsContent>

          <TabsContent value="teams">
            <TeamsManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
