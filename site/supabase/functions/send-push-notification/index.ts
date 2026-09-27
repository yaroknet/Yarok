import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys - stored as secrets
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

// Validate required secrets on startup
if (!VAPID_PRIVATE_KEY) {
  console.error('VAPID_PRIVATE_KEY is required but not configured');
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  targetUserId?: string;
  targetRole?: string;
}

// Simple Web Push implementation
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<Response> {
  const encoder = new TextEncoder();
  
  // Create JWT for VAPID authentication
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: new URL(subscription.endpoint).origin,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: 'mailto:admin@yarokfleet.com'
  };

  // For simplicity, we'll use the fetch API directly with the endpoint
  // In production, you'd want to use a proper web-push library
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: encoder.encode(payload)
  });

  return response;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate VAPID key is configured
    if (!VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Push notifications not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check - require valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Role verification - only managers and super_admins can send notifications
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAuthorized = roles?.some(r => r.role === 'manager' || r.role === 'super_admin');
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Push notification request from user ${user.id} (${user.email})`);

    const payload: PushPayload = await req.json();
    console.log('Sending push notification:', payload);

    // Build query for subscriptions
    let query = supabase.from('push_subscriptions').select('*');

    if (payload.targetUserId) {
      query = query.eq('user_id', payload.targetUserId);
    } else if (payload.targetRole) {
      // Get users with specific role
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', payload.targetRole);

      if (roleUsers && roleUsers.length > 0) {
        const userIds = roleUsers.map(r => r.user_id);
        query = query.in('user_id', userIds);
      }
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      data: payload.data || {}
    });

    let successCount = 0;
    let failCount = 0;
    const failedEndpoints: string[] = [];

    // Send to each subscription
    for (const sub of subscriptions) {
      try {
        // Use native fetch to send push notification
        // Note: This is a simplified version - in production use web-push library
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
          console.log(`Push sent successfully to ${sub.endpoint.substring(0, 50)}...`);
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired or invalid - remove it
          console.log(`Removing expired subscription: ${sub.endpoint.substring(0, 50)}...`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          failCount++;
        } else {
          console.error(`Push failed with status ${response.status} for ${sub.endpoint.substring(0, 50)}...`);
          failCount++;
          failedEndpoints.push(sub.endpoint);
        }
      } catch (error) {
        console.error(`Error sending to ${sub.endpoint.substring(0, 50)}...:`, error);
        failCount++;
        failedEndpoints.push(sub.endpoint);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        total: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
