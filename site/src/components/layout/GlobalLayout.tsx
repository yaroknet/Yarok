import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Car, LogOut, Settings, History, ChevronLeft, ChevronRight, Users, Briefcase, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalNotificationProvider } from '@/components/notifications/GlobalNotificationProvider';

interface GlobalLayoutProps {
  children: React.ReactNode;
}

export const GlobalLayout = ({ children }: GlobalLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isSuperAdmin } = useAuth();
  const isPortal = location.pathname === '/portal';
  const isFleetModule = location.pathname.startsWith('/fleet');
  const isCrmModule = location.pathname.startsWith('/crm') || 
    location.pathname.startsWith('/clients') || 
    location.pathname.startsWith('/complaints') ||
    location.pathname.startsWith('/proposals') ||
    location.pathname.startsWith('/contact-inquiries') ||
    location.pathname.startsWith('/satisfaction-surveys');
  const isFieldModule = location.pathname.startsWith('/field');
  const isProcurementModule = location.pathname.startsWith('/procurement');

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoForward = () => {
    navigate(1);
  };

  const getCurrentModuleInfo = () => {
    if (isFleetModule) return { icon: Car, name: 'ניהול צי רכב' };
    if (isCrmModule) return { icon: Users, name: 'קשרי לקוחות' };
    if (isFieldModule) return { icon: ClipboardList, name: 'יומן שטח' };
    if (isProcurementModule) return { icon: Briefcase, name: 'רכש' };
    return null;
  };

  const moduleInfo = getCurrentModuleInfo();

  return (
    <div className="min-h-screen bg-background/40">
      {/* Global Notification Provider - listens for notifications on all pages */}
      <GlobalNotificationProvider />
      
      {/* Global Top Navigation Bar */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left side - Navigation arrows + Home button */}
          <div className="flex items-center gap-2">
            {/* Navigation Arrows */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="h-8 w-8"
                title="חזור אחורה"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoForward}
                className="h-8 w-8"
                title="קדימה"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <Link to="/portal">
              <Button
                variant={isPortal ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'gap-2',
                  isPortal && 'pointer-events-none'
                )}
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">דף הבית</span>
              </Button>
            </Link>

            {/* Breadcrumb / Current module indicator */}
            {moduleInfo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>/</span>
                <div className="flex items-center gap-1.5 bg-accent/50 px-3 py-1 rounded-full">
                  <moduleInfo.icon className="h-3.5 w-3.5" />
                  <span>{moduleInfo.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Center - Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <img 
              src="/assets/yarok-logo.png" 
              alt="ירוק שירותי אחזקה ניקיון וכח אדם" 
              className="h-10 w-auto"
            />
            <span className="font-bold text-foreground hidden sm:block">ירוק שירותי אחזקה ניקיון וכח אדם</span>
          </div>

          {/* Right side - Notifications + Actions */}
          <div className="flex items-center gap-2">
            {/* Notification Bell - Always visible */}
            <NotificationBell />
            
            {/* Notification History Link */}
            <Link to="/fleet/notifications-log">
              <Button variant="ghost" size="icon" title="היסטוריית התראות">
                <History className="h-5 w-5" />
              </Button>
            </Link>
            
            {isSuperAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline">ניהול</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">יציאה</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-57px)]">
        {children}
      </main>
    </div>
  );
};
