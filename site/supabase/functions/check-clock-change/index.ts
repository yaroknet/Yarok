import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Israel clock change dates for upcoming years
// Winter time: Last Sunday of October
// Summer time: Last Friday of March (before Passover)
function getClockChangeDates(year: number) {
  // Winter time - last Sunday of October
  const october = new Date(year, 9, 31); // October 31
  const winterDay = october.getDate() - october.getDay();
  const winterDate = new Date(year, 9, winterDay);

  // Summer time - last Friday of March
  const march = new Date(year, 2, 31); // March 31
  let summerDay = march.getDate();
  while (new Date(year, 2, summerDay).getDay() !== 5) { // 5 = Friday
    summerDay--;
  }
  const summerDate = new Date(year, 2, summerDay);

  return { winterDate, summerDate };
}

function isNearClockChange(today: Date): { isNear: boolean; type: 'winter' | 'summer' | null; daysUntil: number } {
  const year = today.getFullYear();
  const { winterDate, summerDate } = getClockChangeDates(year);

  const diffToWinter = Math.floor((winterDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const diffToSummer = Math.floor((summerDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Alert 7 days before and 3 days after clock change
  if (diffToWinter >= -3 && diffToWinter <= 7) {
    return { isNear: true, type: 'winter', daysUntil: diffToWinter };
  }
  if (diffToSummer >= -3 && diffToSummer <= 7) {
    return { isNear: true, type: 'summer', daysUntil: diffToSummer };
  }

  // Check next year's dates if we're past this year's
  const nextYear = year + 1;
  const nextYearDates = getClockChangeDates(nextYear);
  const diffToNextWinter = Math.floor((nextYearDates.winterDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const diffToNextSummer = Math.floor((nextYearDates.summerDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffToNextWinter >= -3 && diffToNextWinter <= 7) {
    return { isNear: true, type: 'winter', daysUntil: diffToNextWinter };
  }
  if (diffToNextSummer >= -3 && diffToNextSummer <= 7) {
    return { isNear: true, type: 'summer', daysUntil: diffToNextSummer };
  }

  return { isNear: false, type: null, daysUntil: 0 };
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

    const today = new Date();
    const clockChangeInfo = isNearClockChange(today);

    console.log(`Clock change check: isNear=${clockChangeInfo.isNear}, type=${clockChangeInfo.type}, daysUntil=${clockChangeInfo.daysUntil}`);

    if (!clockChangeInfo.isNear) {
      return new Response(JSON.stringify({ 
        message: 'No clock change nearby',
        sent: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if we already sent a notification today for this clock change
    const todayStr = today.toISOString().split('T')[0];
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'clock_change')
      .gte('created_at', todayStr)
      .single();

    if (existingNotification) {
      console.log('Clock change notification already sent today');
      return new Response(JSON.stringify({ 
        message: 'Notification already sent today',
        sent: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare notification content
    const isWinter = clockChangeInfo.type === 'winter';
    let title: string;
    let body: string;

    if (clockChangeInfo.daysUntil > 0) {
      title = isWinter 
        ? `🕐 שעון חורף בעוד ${clockChangeInfo.daysUntil} ימים` 
        : `🕐 שעון קיץ בעוד ${clockChangeInfo.daysUntil} ימים`;
      body = isWinter
        ? 'תזכורת: יש לנהוג עם פנסים דולקים! החשיכה תגיע מוקדם יותר.'
        : 'תזכורת: נהגו בזהירות בימים הקרובים בעקבות שינוי השעון.';
    } else if (clockChangeInfo.daysUntil === 0) {
      title = isWinter ? '🕐 הלילה עוברים לשעון חורף!' : '🕐 הלילה עוברים לשעון קיץ!';
      body = isWinter
        ? 'חשוב: החל ממחר יש לנהוג עם אורות דולקים גם ביום! החשיכה מגיעה מוקדם.'
        : 'חשוב: נהגו בזהירות יתרה בימים הקרובים, הגוף מתאים את עצמו לשינוי.';
    } else {
      title = isWinter ? '💡 תזכורת: נהיגה עם אורות!' : '⚠️ תזכורת: זהירות בכבישים!';
      body = isWinter
        ? 'בתקופת שעון החורף מומלץ לנהוג עם פנסים דולקים גם בשעות היום.'
        : 'בימים שאחרי המעבר לשעון קיץ, נהגו בזהירות יתרה עקב עייפות.';
    }

    // Create notification in database
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        title,
        body,
        type: 'clock_change',
        target_type: 'all',
        created_by: '00000000-0000-0000-0000-000000000000',
        sent_at: new Date().toISOString(),
        data: { 
          clock_change_type: clockChangeInfo.type,
          days_until: clockChangeInfo.daysUntil,
          url: '/general-info'
        },
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
      throw notifError;
    }

    // Send push notifications to all drivers
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(JSON.stringify({ 
        message: 'Notification created, no push subscriptions',
        sent: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending push to ${subscriptions.length} subscriptions`);

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      data: { url: '/general-info', type: 'clock_change' }
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

    console.log(`Clock change notifications sent: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({ 
      message: 'Clock change notification sent',
      type: clockChangeInfo.type,
      daysUntil: clockChangeInfo.daysUntil,
      sent: successCount,
      failed: failCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-clock-change:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});