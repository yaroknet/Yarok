import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  target_type: string;
  target_user_id: string | null;
  target_role: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string;
  created_at: string;
  data: unknown;
  read_at?: string;
  received_at?: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const markedAsReceivedRef = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .or(`target_type.eq.all,target_user_id.eq.${user.id}`)
        .not('sent_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      // Fetch read/received status
      const { data: readsData, error: readsError } = await supabase
        .from('notification_reads')
        .select('notification_id, read_at, received_at')
        .eq('user_id', user.id);

      if (readsError) throw readsError;

      const readsMap = new Map(readsData?.map(r => [r.notification_id, { read_at: r.read_at, received_at: r.received_at }]) || []);

      const enrichedNotifications = (notificationsData || []).map(n => ({
        ...n,
        read_at: readsMap.get(n.id)?.read_at || undefined,
        received_at: readsMap.get(n.id)?.received_at || undefined,
      }));

      setNotifications(enrichedNotifications);
      setUnreadCount(enrichedNotifications.filter(n => !n.read_at).length);

      // Mark notifications as received when they appear
      const notReceivedYet = enrichedNotifications.filter(
        n => !n.received_at && !markedAsReceivedRef.current.has(n.id)
      );

      for (const notification of notReceivedYet) {
        markedAsReceivedRef.current.add(notification.id);
        markAsReceived(notification.id);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markAsReceived = async (notificationId: string) => {
    if (!user) return;

    try {
      // Upsert with received_at but no read_at
      await supabase
        .from('notification_reads')
        .upsert({
          notification_id: notificationId,
          user_id: user.id,
          received_at: new Date().toISOString(),
          device_info: navigator.userAgent,
        }, {
          onConflict: 'notification_id,user_id',
          ignoreDuplicates: true,
        });

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, received_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error('Error marking notification as received:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notification_reads')
        .upsert({
          notification_id: notificationId,
          user_id: user.id,
          read_at: now,
          received_at: now, // Also set received if not already
          device_info: navigator.userAgent,
        }, {
          onConflict: 'notification_id,user_id',
        });

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: now, received_at: n.received_at || now } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const unreadNotifications = notifications.filter(n => !n.read_at);
      
      for (const notification of unreadNotifications) {
        await supabase
          .from('notification_reads')
          .upsert({
            notification_id: notification.id,
            user_id: user.id,
            read_at: now,
            received_at: notification.received_at || now,
            device_info: navigator.userAgent,
          }, {
            onConflict: 'notification_id,user_id',
          });
      }

      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || now, received_at: n.received_at || now }))
      );
      setUnreadCount(0);
      toast.success('כל ההתראות סומנו כנקראו');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to realtime updates and show push-like notifications
  useEffect(() => {
    if (!user) return;

    // Several components use this hook at once; each needs its own channel, since
    // supabase.channel() returns the already-subscribed one for a repeated name
    const channel = supabase
      .channel(`notifications-changes-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notification = payload.new as any;
          // Show toast for new notifications
          if (notification.title && notification.body) {
            toast(notification.title, {
              description: notification.body,
              duration: 5000,
            });
          }
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
};
