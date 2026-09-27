import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  MessageSquareWarning, 
  FileText, 
  Phone,
  Building2,
  ClipboardList,
  ClipboardCheck

} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PulsingDot } from '@/components/ui/pulsing-dot';
import { useModuleUpdates } from '@/hooks/useModuleUpdates';

interface SubModule {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  adminOnly?: boolean;
  badgeCount?: number;
  categoryKey?: string;
}

const ClientRelationsHub = () => {
  const navigate = useNavigate();
  const { userRole, isSuperAdmin } = useAuth();
  const [newInquiriesCount, setNewInquiriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { hasCategoryUpdates, markModuleAsViewed } = useModuleUpdates();

  // Mark CRM as viewed when entering
  useEffect(() => {
    markModuleAsViewed('crm');
  }, []);

  useEffect(() => {
    const fetchNewInquiriesCount = async () => {
      try {
        const { count, error } = await supabase
          .from('contact_inquiries')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'new');

        if (error) throw error;
        setNewInquiriesCount(count || 0);
      } catch (error) {
        console.error('Error fetching inquiries count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewInquiriesCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('contact_inquiries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_inquiries',
        },
        () => {
          fetchNewInquiriesCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const subModules: SubModule[] = [
    {
      id: 'clients',
      name: 'clients',
      displayName: 'ניהול לקוחות',
      description: 'ניהול רשימת לקוחות וסניפים',
      icon: Building2,
      route: '/clients',
      categoryKey: 'clients',
    },
    {
      id: 'complaints',
      name: 'complaints',
      displayName: 'תלונות לקוחות',
      description: 'ניהול תלונות ופניות לקוחות',
      icon: MessageSquareWarning,
      route: '/complaints',
      categoryKey: 'complaints',
    },
    {
      id: 'proposals',
      name: 'proposals',
      displayName: 'הצעות מחיר',
      description: 'יצירה וניהול הצעות מחיר',
      icon: FileText,
      route: '/proposals',
      categoryKey: 'proposals',
    },
    {
      id: 'satisfaction-surveys',
      name: 'satisfaction-surveys',
      displayName: 'סקר שביעות רצון',
      description: 'ניהול ומעקב סקרי לקוחות',
      icon: ClipboardList,
      route: '/satisfaction-surveys',
      adminOnly: true,
      categoryKey: 'surveys',
    },
    {
      id: 'area-audits',
      name: 'area-audits',
      displayName: 'ביקורות מנהלי אזור',
      description: 'ביקורות סניפי סופר-פארם ושביעות רצון',
      icon: ClipboardCheck,
      route: '/area-audits',
      categoryKey: 'area-audits',
    },
    {
      id: 'contact-inquiries',
      name: 'contact-inquiries',
      displayName: 'פניות יצירת קשר',
      description: 'טיפול בפניות מטופס האתר',
      icon: Phone,
      route: '/contact-inquiries',
      adminOnly: true,
      badgeCount: newInquiriesCount,
      categoryKey: 'inquiries',
    },
  ];

  const handleModuleClick = (subModule: SubModule) => {
    if (subModule.adminOnly && !isSuperAdmin && userRole !== 'manager') {
      return;
    }
    navigate(subModule.route);
  };

  const filteredModules = subModules.filter(
    (mod) => !mod.adminOnly || isSuperAdmin || userRole === 'manager'
  );

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">קשרי לקוחות</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">ניהול קשרי לקוחות</h1>
        <p className="text-muted-foreground">בחר את התחום שברצונך לנהל</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {filteredModules.map((subModule) => {
          const IconComponent = subModule.icon;
          const hasBadge = subModule.badgeCount && subModule.badgeCount > 0;
          const hasCategoryUpdate = subModule.categoryKey 
            ? hasCategoryUpdates('crm', subModule.categoryKey) 
            : false;

          return (
            <Card
              key={subModule.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] bg-card/90 hover:bg-card relative"
              onClick={() => handleModuleClick(subModule)}
            >
              {/* Pulsing dot for category updates */}
              {hasCategoryUpdate && !hasBadge && (
                <div className="absolute -top-1 -right-1 z-10">
                  <PulsingDot size="lg" color="destructive" />
                </div>
              )}
              {hasBadge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-6 min-w-6 flex items-center justify-center text-xs font-bold"
                >
                  {subModule.badgeCount}
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 mx-auto rounded-xl bg-primary flex items-center justify-center mb-3">
                  <IconComponent className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg">{subModule.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <CardDescription className="text-sm">
                  {subModule.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ClientRelationsHub;
