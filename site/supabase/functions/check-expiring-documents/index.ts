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

    console.log('Starting expiring documents check...');

    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 30); // 30 days warning

    const todayStr = today.toISOString().split('T')[0];
    const warningDateStr = warningDate.toISOString().split('T')[0];

    // Get all active vehicle assignments with driver info
    const { data: assignments, error: assignmentsError } = await supabase
      .from('vehicle_assignments')
      .select(`
        driver_id,
        vehicle_id,
        vehicles (id, license_plate, make, model)
      `)
      .eq('is_active', true);

    type VehicleInfo = { id: string; license_plate: string; make?: string; model?: string };

    if (assignmentsError) {
      throw assignmentsError;
    }

    console.log(`Found ${assignments?.length || 0} active assignments`);

    // Get driver profiles with license expiry
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, driver_license_expiry')
      .not('driver_license_expiry', 'is', null)
      .lte('driver_license_expiry', warningDateStr);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles with expiring licenses`);

    // Get expiring documents
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', warningDateStr)
      .in('document_type', ['רישיון רכב', 'ביטוח', 'vehicle_license', 'insurance', 'רישיון נהיגה', 'driver_license']);

    if (documentsError) {
      throw documentsError;
    }

    console.log(`Found ${documents?.length || 0} expiring documents`);

    let notificationsCreated = 0;
    let pushNotificationsSent = 0;

    // Process driver license expiry from profiles
    for (const profile of profiles || []) {
      if (!profile.driver_license_expiry) continue;

      const expiryDate = new Date(profile.driver_license_expiry);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const isExpired = daysUntilExpiry < 0;
      const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
      const isExpiringLater = daysUntilExpiry <= 30 && daysUntilExpiry > 7;

      // Determine notification frequency based on urgency
      let shouldNotify = false;
      let frequencyDays = 7; // Default weekly

      if (isExpired) {
        frequencyDays = 1; // Daily for expired
        shouldNotify = true;
      } else if (isExpiringSoon) {
        frequencyDays = 1; // Daily for soon expiring
        shouldNotify = true;
      } else if (isExpiringLater) {
        frequencyDays = 7; // Weekly for 30 day warning
        shouldNotify = true;
      }

      if (!shouldNotify) continue;

      // Check if notification was already sent within frequency period
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - frequencyDays);

      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>type', 'driver_license_expiry')
        .eq('target_user_id', profile.user_id)
        .gte('created_at', checkDate.toISOString())
        .maybeSingle();

      if (existingNotification) {
        console.log(`Notification already sent for driver license of user ${profile.user_id}`);
        continue;
      }

      const title = isExpired 
        ? '🚨 רישיון הנהיגה שלך פג תוקף!' 
        : `⚠️ רישיון הנהיגה שלך יפוג בעוד ${daysUntilExpiry} ימים`;
      
      const body = isExpired
        ? 'יש לחדש את רישיון הנהיגה באופן מיידי'
        : `תאריך תפוגה: ${profile.driver_license_expiry}. יש לחדש בהקדם.`;

      // Create notification record
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          title,
          body,
          type: 'document_expiry',
          target_type: 'user',
          target_user_id: profile.user_id,
          created_by: profile.user_id,
          sent_at: new Date().toISOString(),
          data: { 
            type: 'driver_license_expiry',
            expiry_date: profile.driver_license_expiry,
            url: '/' 
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
          profile.user_id,
          { type: 'driver_license_expiry', url: '/' }
        );
        pushNotificationsSent += pushResult.sent;
      }
    }

    // Process vehicle documents (license, insurance)
    for (const doc of documents || []) {
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const isExpired = daysUntilExpiry < 0;
      const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
      const isExpiringLater = daysUntilExpiry <= 30 && daysUntilExpiry > 7;

      // Determine if we should notify and frequency
      let shouldNotify = false;
      let frequencyDays = 7;

      if (isExpired) {
        frequencyDays = 1;
        shouldNotify = true;
      } else if (isExpiringSoon) {
        frequencyDays = 1;
        shouldNotify = true;
      } else if (isExpiringLater) {
        frequencyDays = 7;
        shouldNotify = true;
      }

      if (!shouldNotify) continue;

      // Find driver assigned to this vehicle
      let targetDriverId = doc.driver_id;
      let vehicleInfo = '';

      if (doc.vehicle_id) {
        const assignment = assignments?.find(a => a.vehicle_id === doc.vehicle_id);
        if (assignment) {
          targetDriverId = assignment.driver_id;
          const vehicle = assignment.vehicles as VehicleInfo | VehicleInfo[] | null;
          const vehicleData = Array.isArray(vehicle) ? vehicle[0] : vehicle;
          if (vehicleData) {
            vehicleInfo = `${vehicleData.license_plate}${vehicleData.make ? ` - ${vehicleData.make}` : ''}${vehicleData.model ? ` ${vehicleData.model}` : ''}`;
          }
        }
      }

      if (!targetDriverId) {
        console.log(`No driver found for document ${doc.id}`);
        continue;
      }

      // Check if notification was already sent
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - frequencyDays);

      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>document_id', doc.id)
        .eq('target_user_id', targetDriverId)
        .gte('created_at', checkDate.toISOString())
        .maybeSingle();

      if (existingNotification) {
        console.log(`Notification already sent for document ${doc.id}`);
        continue;
      }

      const isInsurance = doc.document_type.includes('ביטוח') || doc.document_type === 'insurance';
      const docTypeLabel = isInsurance ? 'ביטוח הרכב' : 'רישיון הרכב';

      const title = isExpired 
        ? `🚨 ${docTypeLabel} פג תוקף!` 
        : `⚠️ ${docTypeLabel} יפוג בעוד ${daysUntilExpiry} ימים`;
      
      const body = vehicleInfo 
        ? `${docTypeLabel} לרכב ${vehicleInfo} ${isExpired ? 'פג תוקף' : `יפוג ב-${doc.expiry_date}`}`
        : `${isExpired ? 'יש לחדש באופן מיידי' : `תאריך תפוגה: ${doc.expiry_date}`}`;

      // Create notification record
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          title,
          body,
          type: 'document_expiry',
          target_type: 'user',
          target_user_id: targetDriverId,
          created_by: targetDriverId,
          sent_at: new Date().toISOString(),
          data: { 
            document_id: doc.id,
            vehicle_id: doc.vehicle_id,
            document_type: doc.document_type,
            expiry_date: doc.expiry_date,
            url: '/' 
          },
        });

      if (notifError) {
        console.error(`Error creating notification:`, notifError);
      } else {
        notificationsCreated++;
        
        // Send push notification to driver
        const pushResult = await sendPushNotification(
          supabase,
          title,
          body,
          targetDriverId,
          { document_id: doc.id, url: '/' }
        );
        pushNotificationsSent += pushResult.sent;
      }
    }

    console.log(`Completed: ${notificationsCreated} notifications created, ${pushNotificationsSent} push notifications sent`);

    return new Response(JSON.stringify({ 
      message: 'Expiring documents check completed',
      profilesChecked: profiles?.length || 0,
      documentsChecked: documents?.length || 0,
      notificationsCreated,
      pushNotificationsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-expiring-documents:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
