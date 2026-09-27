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
  targetUserId: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);
    
    const subscriptions = (subs || []) as PushSubscription[];

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${targetUserId}`);
      return { sent: 0, failed: 0 };
    }

    console.log(`Sending push to ${subscriptions.length} subscriptions for user ${targetUserId}`);

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

    console.log('Starting fines deadline check...');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get pending fines with approaching deadlines (7 days warning)
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 7);
    const warningDateStr = warningDate.toISOString().split('T')[0];

    // Get all pending fines where payment deadline is approaching or passed
    const { data: fines, error: finesError } = await supabase
      .from('fines')
      .select(`
        id,
        report_number,
        amount,
        payment_deadline,
        violation_type,
        driver_id,
        vehicle_id
      `)
      .eq('status', 'pending')
      .lte('payment_deadline', warningDateStr)
      .order('payment_deadline', { ascending: true });

    if (finesError) {
      throw finesError;
    }

    console.log(`Found ${fines?.length || 0} pending fines with approaching deadlines`);

    let notificationsCreated = 0;
    let pushNotificationsSent = 0;

    for (const fine of fines || []) {
      const deadlineDate = new Date(fine.payment_deadline);
      const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const isOverdue = daysUntilDeadline < 0;
      const isDueSoon = daysUntilDeadline <= 3 && daysUntilDeadline >= 0;
      const isApproaching = daysUntilDeadline <= 7 && daysUntilDeadline > 3;

      // Determine notification frequency based on urgency
      let shouldNotify = false;
      let frequencyDays = 7; // Default weekly

      if (isOverdue) {
        frequencyDays = 1; // Daily for overdue
        shouldNotify = true;
      } else if (isDueSoon) {
        frequencyDays = 1; // Daily for soon due
        shouldNotify = true;
      } else if (isApproaching) {
        frequencyDays = 3; // Every 3 days for approaching
        shouldNotify = true;
      }

      if (!shouldNotify || !fine.driver_id) continue;

      // Check if notification was already sent within frequency period
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - frequencyDays);

      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>fine_id', fine.id)
        .eq('target_user_id', fine.driver_id)
        .gte('created_at', checkDate.toISOString())
        .maybeSingle();

      if (existingNotification) {
        console.log(`Notification already sent for fine ${fine.id}`);
        continue;
      }

      let title: string;
      let body: string;
      const amountFormatted = `₪${Number(fine.amount).toLocaleString()}`;

      if (isOverdue) {
        const daysPast = Math.abs(daysUntilDeadline);
        title = '🚨 קנס באיחור תשלום!';
        body = `קנס ${fine.report_number} בסך ${amountFormatted} עבר את מועד התשלום ב-${daysPast} ימים. יש לשלם מיידית!`;
      } else if (isDueSoon) {
        title = '⚠️ קנס מתקרב למועד האחרון';
        body = `קנס ${fine.report_number} בסך ${amountFormatted} צריך להיות משולם בעוד ${daysUntilDeadline} ימים.`;
      } else {
        title = '📋 תזכורת לתשלום קנס';
        body = `קנס ${fine.report_number} בסך ${amountFormatted} צריך להיות משולם עד ${fine.payment_deadline}.`;
      }

      // Create notification record
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          title,
          body,
          type: 'fine_deadline',
          target_type: 'user',
          target_user_id: fine.driver_id,
          created_by: fine.driver_id,
          sent_at: new Date().toISOString(),
          data: { 
            fine_id: fine.id,
            report_number: fine.report_number,
            amount: fine.amount,
            payment_deadline: fine.payment_deadline,
            is_overdue: isOverdue,
            url: '/fines' 
          },
        });

      if (notifError) {
        console.error(`Error creating notification:`, notifError);
      } else {
        notificationsCreated++;
        
        // Send push notification
        const pushResult = await sendPushNotification(
          supabase,
          title,
          body,
          fine.driver_id,
          { fine_id: fine.id, url: '/fines' }
        );
        pushNotificationsSent += pushResult.sent;
      }
    }

    console.log(`Completed: ${notificationsCreated} notifications created, ${pushNotificationsSent} push notifications sent`);

    return new Response(JSON.stringify({ 
      message: 'Fines deadline check completed',
      finesChecked: fines?.length || 0,
      notificationsCreated,
      pushNotificationsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-fines-deadline:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
