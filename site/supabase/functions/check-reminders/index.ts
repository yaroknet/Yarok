import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Helper function to send push notifications
async function sendPushNotification(
  supabase: SupabaseClient,
  title: string,
  body: string,
  targetUserId?: string,
  targetRole?: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  try {
    let subscriptions: PushSubscription[] = [];

    if (targetUserId) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', targetUserId);
      subscriptions = (subs || []) as PushSubscription[];
    } else if (targetRole) {
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', targetRole);

      if (roleUsers && roleUsers.length > 0) {
        const userIds = roleUsers.map((r: { user_id: string }) => r.user_id);
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', userIds);
        subscriptions = (subs || []) as PushSubscription[];
      }
    } else {
      const { data: subs } = await supabase.from('push_subscriptions').select('*');
      subscriptions = (subs || []) as PushSubscription[];
    }

    if (subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return { sent: 0, failed: 0 };
    }

    console.log(`Sending push to ${subscriptions.length} subscriptions`);

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      data: data || {}
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: notificationPayload
        });

        if (response.ok || response.status === 201) {
          successCount++;
        } else if (response.status === 410 || response.status === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          failCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Error sending push:`, error);
        failCount++;
      }
    }

    return { sent: successCount, failed: failCount };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { sent: 0, failed: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all reminders that are due or overdue
    const today = new Date().toISOString().split('T')[0];
    
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select(`
        *,
        vehicles (license_plate, make, model, manager_id)
      `)
      .neq('status', 'completed')
      .lte('due_date', today);

    if (remindersError) {
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} due/overdue reminders`);

    // Get notification settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', 'reminder_notifications')
      .single();

    const notificationEnabled = (settings?.setting_value as { enabled?: boolean })?.enabled !== false;

    if (!notificationEnabled) {
      return new Response(JSON.stringify({ 
        message: 'Reminder notifications disabled',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reminderTypeLabels: Record<string, string> = {
      test: 'טסט',
      insurance: 'ביטוח',
      maintenance: 'טיפול',
      repair: 'תיקון',
      license: 'רישיון',
      vehicle_license: 'רישיון רכב',
      driver_license: 'רישיון נהיגה',
      document: 'מסמך',
    };

    let notificationsCreated = 0;
    let pushNotificationsSent = 0;

    for (const reminder of reminders || []) {
      const vehicle = reminder.vehicles as { license_plate: string; make: string; model: string; manager_id: string } | null;
      if (!vehicle) continue;

      const isOverdue = new Date(reminder.due_date) < new Date(today);
      const typeLabel = reminderTypeLabels[reminder.reminder_type] || reminder.reminder_type;

      const alertType = reminder.alert_type || 'one_time';
      const alertFrequency = reminder.alert_frequency || 'daily';
      
      if (alertType === 'one_time' && !isOverdue && reminder.due_date !== today) {
        continue;
      }

      const frequencyDays = alertFrequency === 'weekly' ? 7 : 1;
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - frequencyDays);
      
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>reminder_id', reminder.id)
        .gte('created_at', checkDate.toISOString())
        .single();

      if (existingNotification) {
        console.log(`Notification already sent for reminder ${reminder.id} within frequency period`);
        continue;
      }

      const notificationTitle = isOverdue ? `⚠️ ${typeLabel} באיחור!` : `🔔 תזכורת: ${typeLabel}`;
      const notificationBody = `${typeLabel} לרכב ${vehicle.license_plate} ${isOverdue ? 'באיחור' : 'מתקרב'}. תאריך יעד: ${reminder.due_date}`;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          title: notificationTitle,
          body: notificationBody,
          type: 'reminder',
          target_type: vehicle.manager_id ? 'user' : 'role',
          target_user_id: vehicle.manager_id || null,
          target_role: vehicle.manager_id ? null : 'manager',
          created_by: vehicle.manager_id || '00000000-0000-0000-0000-000000000000',
          sent_at: new Date().toISOString(),
          data: { reminder_id: reminder.id, vehicle_id: reminder.vehicle_id },
        });

      if (notifError) {
        console.error(`Error creating notification for reminder ${reminder.id}:`, notifError);
      } else {
        notificationsCreated++;

        const pushResult = await sendPushNotification(
          supabase,
          notificationTitle,
          notificationBody,
          vehicle.manager_id || undefined,
          vehicle.manager_id ? undefined : 'manager',
          { reminder_id: reminder.id, vehicle_id: reminder.vehicle_id, url: '/documents' }
        );
        pushNotificationsSent += pushResult.sent;
      }

      await supabase
        .from('reminders')
        .update({ status: isOverdue ? 'overdue' : 'due' })
        .eq('id', reminder.id);
    }

    console.log(`Created ${notificationsCreated} notifications, sent ${pushNotificationsSent} push notifications`);

    return new Response(JSON.stringify({ 
      message: 'Reminder check completed',
      processed: reminders?.length || 0,
      notificationsCreated,
      pushNotificationsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-reminders:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
