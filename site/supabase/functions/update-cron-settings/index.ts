import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const NotificationSettingsSchema = z.object({
  reminders_enabled: z.boolean(),
  km_check_enabled: z.boolean(),
  check_hour: z.number().int().min(0).max(23),
  check_minute: z.number().int().min(0).max(59),
  reminder_days_before: z.number().int().min(1).max(90),
  km_deviation_threshold: z.number().min(0).max(100),
});

type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

// Sanitize error messages - never expose internal details
function sanitizeError(error: unknown, correlationId: string): string {
  console.error(`[${correlationId}] Internal error:`, error);
  
  if (error instanceof z.ZodError) {
    return 'נתונים לא תקינים - אנא בדוק את הערכים שהוזנו';
  }
  
  return 'אירעה שגיאה, אנא נסה שוב מאוחר יותר';
}

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. AUTHENTICATION CHECK - Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log(`[${correlationId}] No authorization header provided`);
      return new Response(
        JSON.stringify({ success: false, error: 'לא מורשה - נדרשת התחברות' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`[${correlationId}] Invalid token:`, authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'לא מורשה - טוקן לא תקין' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    // 2. AUTHORIZATION CHECK - Verify user is super_admin
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error(`[${correlationId}] Error fetching roles:`, rolesError);
      return new Response(
        JSON.stringify({ success: false, error: 'שגיאה באימות הרשאות' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500 
        }
      );
    }

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      console.log(`[${correlationId}] User ${user.id} attempted to access cron settings without super_admin role`);
      return new Response(
        JSON.stringify({ success: false, error: 'אין הרשאה - נדרשת הרשאת מנהל על' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }

    // 3. INPUT VALIDATION - Validate request body with Zod schema
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'גוף הבקשה לא תקין' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    const validationResult = NotificationSettingsSchema.safeParse(requestBody.settings);
    if (!validationResult.success) {
      console.log(`[${correlationId}] Validation failed:`, validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'נתונים לא תקינים',
          details: validationResult.error.errors.map(e => e.message)
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    const settings = validationResult.data;
    console.log(`[${correlationId}] User ${user.id} updating cron settings:`, settings);

    // Build cron expression: minute hour * * *
    const cronMinute = settings.check_minute;
    const cronHour = settings.check_hour;
    const cronExpression = `${cronMinute} ${cronHour} * * *`;
    const cronExpressionKm = `${(cronMinute + 5) % 60} ${cronMinute + 5 > 59 ? (cronHour + 1) % 24 : cronHour} * * *`;

    // Unschedule existing jobs
    try {
      await supabase.rpc("cron_unschedule", { job_name: "daily-check-reminders" });
    } catch (e) {
      console.log(`[${correlationId}] No existing reminders job to unschedule`);
    }
    
    try {
      await supabase.rpc("cron_unschedule", { job_name: "daily-check-monthly-km" });
    } catch (e) {
      console.log(`[${correlationId}] No existing km job to unschedule`);
    }

    // Schedule new jobs if enabled
    if (settings.reminders_enabled) {
      await supabase.from("cron_jobs_log").insert({
        job_name: "daily-check-reminders",
        schedule: cronExpression,
        status: "scheduled",
      });
      
      console.log(`[${correlationId}] Scheduled reminders check at ${cronExpression}`);
    }

    if (settings.km_check_enabled) {
      await supabase.from("cron_jobs_log").insert({
        job_name: "daily-check-monthly-km",
        schedule: cronExpressionKm,
        status: "scheduled",
      });
      
      console.log(`[${correlationId}] Scheduled KM check at ${cronExpressionKm}`);
    }

    // Log to audit table
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update_cron_settings",
      table_name: "cron_jobs_log",
      new_values: settings,
    });

    console.log(`[${correlationId}] Cron settings updated successfully by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "הגדרות עודכנו בהצלחה",
        reminders_schedule: settings.reminders_enabled ? cronExpression : "disabled",
        km_schedule: settings.km_check_enabled ? cronExpressionKm : "disabled",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = sanitizeError(error, correlationId);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, correlationId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
