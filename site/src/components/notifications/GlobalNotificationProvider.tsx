import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// This component provides global notification listening and toast display
export const GlobalNotificationProvider = () => {
  const { user, roles } = useAuth();
  const { refresh } = useNotifications();

  useEffect(() => {
    if (!user) return;

    // Subscribe to new notifications that target this user specifically
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notification = payload.new as any;
          
          // Check if this notification is for the current user
          const isForUser = 
            notification.target_type === 'all' ||
            notification.target_user_id === user.id ||
            (notification.target_type === 'role' && roles.includes(notification.target_role));

          if (isForUser && notification.title && notification.body) {
            // Show toast notification
            toast(notification.title, {
              description: notification.body,
              duration: 8000,
              action: {
                label: 'צפה',
                onClick: () => {
                  // This will be handled by the notification bell
                },
              },
            });
            
            // Refresh notifications list
            refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, roles, refresh]);

  return null;
};
