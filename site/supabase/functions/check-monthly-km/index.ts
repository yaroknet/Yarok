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

interface Vehicle {
  id: string;
  license_plate: string;
  make: string | null;
  model: string | null;
  manager_id: string | null;
  current_km: number | null;
  initial_km: number | null;
  annual_km_limit: number | null;
  total_km_limit: number | null;
  leasing_start_date: string | null;
  leasing_months: number | null;
  status: string | null;
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
      return { sent: 0, failed: 0 };
    }

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
          headers: { 'Content-Type': 'application/json', 'TTL': '86400' },
          body: notificationPayload
        });

        if (response.ok || response.status === 201) {
          successCount++;
        } else if (response.status === 410 || response.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          failCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    return { sent: successCount, failed: failCount };
  } catch {
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

    console.log('Starting monthly KM check...');

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const reportMonth = currentMonthStart.toISOString().split('T')[0];

    console.log(`Checking for month: ${reportMonth}`);

    // Get all vehicles with leasing info for KM deviation check
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'active');

    if (vehiclesError) {
      console.error('Error fetching vehicles:', vehiclesError);
      throw vehiclesError;
    }

    const vehicles = (vehiclesData || []) as Vehicle[];
    let kmDeviationAlerts = 0;
    let pushSent = 0;

    // Check each vehicle for KM deviations
    for (const vehicle of vehicles) {
      if (!vehicle.leasing_start_date || !vehicle.annual_km_limit) continue;

      const leasingStart = new Date(vehicle.leasing_start_date);
      const monthsElapsed = Math.max(1, 
        (now.getFullYear() - leasingStart.getFullYear()) * 12 + 
        (now.getMonth() - leasingStart.getMonth()) + 1
      );

      const currentKm = vehicle.current_km || 0;
      const initialKm = vehicle.initial_km || 0;
      const kmDriven = currentKm - initialKm;

      // Monthly deviation check
      const expectedMonthlyKm = (vehicle.annual_km_limit / 12) * monthsElapsed;
      const monthlyDeviation = expectedMonthlyKm > 0 ? ((kmDriven - expectedMonthlyKm) / expectedMonthlyKm) * 100 : 0;

      // Annual deviation check
      const yearsElapsed = Math.max(1, monthsElapsed / 12);
      const expectedAnnualKm = vehicle.annual_km_limit * yearsElapsed;
      const annualDeviation = expectedAnnualKm > 0 ? ((kmDriven - expectedAnnualKm) / expectedAnnualKm) * 100 : 0;

      // Total leasing period check
      const leasingMonths = vehicle.leasing_months || 36;
      const totalKmLimit = vehicle.total_km_limit || (vehicle.annual_km_limit * (leasingMonths / 12));
      const totalDeviation = totalKmLimit > 0 ? ((kmDriven - totalKmLimit) / totalKmLimit) * 100 : 0;

      const deviationThreshold = 10; // 10% threshold

      const alerts: string[] = [];
      
      if (monthlyDeviation > deviationThreshold) {
        alerts.push(`חריגה חודשית: ${monthlyDeviation.toFixed(1)}%`);
      }
      if (annualDeviation > deviationThreshold) {
        alerts.push(`חריגה שנתית: ${annualDeviation.toFixed(1)}%`);
      }
      if (totalDeviation > deviationThreshold) {
        alerts.push(`חריגה מסך התקופה: ${totalDeviation.toFixed(1)}%`);
      }

      if (alerts.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>vehicle_id', vehicle.id)
          .eq('type', 'km_deviation')
          .gte('created_at', today.toISOString())
          .single();

        if (existingNotification) {
          console.log(`Already sent KM deviation notification today for vehicle ${vehicle.id}`);
          continue;
        }

        const notificationTitle = `⚠️ חריגת ק"מ - ${vehicle.license_plate}`;
        const notificationBody = `רכב ${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.license_plate}): ${alerts.join(', ')}`;

        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            title: notificationTitle,
            body: notificationBody,
            type: 'km_deviation',
            target_type: vehicle.manager_id ? 'user' : 'role',
            target_user_id: vehicle.manager_id || null,
            target_role: vehicle.manager_id ? null : 'manager',
            created_by: vehicle.manager_id || '00000000-0000-0000-0000-000000000000',
            sent_at: new Date().toISOString(),
            data: { 
              vehicle_id: vehicle.id, 
              monthly_deviation: monthlyDeviation,
              annual_deviation: annualDeviation,
              total_deviation: totalDeviation
            },
          });

        if (!notifError) {
          kmDeviationAlerts++;

          const pushResult = await sendPushNotification(
            supabase,
            notificationTitle,
            notificationBody,
            vehicle.manager_id || undefined,
            vehicle.manager_id ? undefined : 'manager',
            { vehicle_id: vehicle.id, url: '/km-deviation' }
          );
          pushSent += pushResult.sent;
        }
      }
    }

    // Get all active vehicle assignments for monthly report reminder
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('vehicle_assignments')
      .select(`
        driver_id,
        vehicle_id,
        vehicles (license_plate, make, model)
      `)
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      throw assignmentsError;
    }

    const assignments = assignmentsData || [];
    console.log(`Found ${assignments.length} active assignments`);

    if (assignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active assignments found',
          kmDeviationAlerts,
          pushSent
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing reports for this month
    const { data: existingReports, error: reportsError } = await supabase
      .from('monthly_km_reports')
      .select('driver_id, vehicle_id')
      .eq('report_month', reportMonth);

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      throw reportsError;
    }

    const submittedSet = new Set(
      (existingReports || []).map((r: { driver_id: string; vehicle_id: string }) => `${r.driver_id}-${r.vehicle_id}`)
    );

    const missingDrivers = assignments.filter(
      (a: { driver_id: string; vehicle_id: string }) => !submittedSet.has(`${a.driver_id}-${a.vehicle_id}`)
    );

    console.log(`${missingDrivers.length} drivers haven't submitted yet`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    let notificationsSent = 0;

    for (const driver of missingDrivers) {
      // deno-lint-ignore no-explicit-any
      const vehicleRaw = driver.vehicles as any;
      const vehicleData = Array.isArray(vehicleRaw) ? vehicleRaw[0] : vehicleRaw;
      const vehicleInfo = vehicleData 
        ? `${vehicleData.make || ''} ${vehicleData.model || ''} (${vehicleData.license_plate})`
        : 'הרכב שלך';

      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('target_user_id', driver.driver_id)
        .eq('type', 'km_reminder')
        .gte('created_at', todayStr)
        .single();

      if (existingNotification) {
        continue;
      }

      const notificationTitle = '📷 תזכורת העלאת ק"מ חודשי';
      const notificationBody = `טרם העלית צילום ק"מ עבור ${vehicleInfo} לחודש הנוכחי. אנא העלה בהקדם.`;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          title: notificationTitle,
          body: notificationBody,
          type: 'km_reminder',
          target_type: 'single',
          target_user_id: driver.driver_id,
          created_by: driver.driver_id,
          sent_at: new Date().toISOString(),
          data: { vehicle_id: driver.vehicle_id, report_month: reportMonth },
        });

      if (!notifError) {
        notificationsSent++;

        const pushResult = await sendPushNotification(
          supabase,
          notificationTitle,
          notificationBody,
          driver.driver_id as string,
          undefined,
          { vehicle_id: driver.vehicle_id, url: '/km-history' }
        );
        pushSent += pushResult.sent;
      }
    }

    console.log(`Finished. Sent ${notificationsSent} KM reminder notifications, ${kmDeviationAlerts} deviation alerts, ${pushSent} push notifications.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${vehicles.length} vehicles, ${assignments.length} assignments`,
        kmDeviationAlerts,
        kmRemindersSent: notificationsSent,
        pushNotificationsSent: pushSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-monthly-km:', error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
