// Generic custom reminder runner - reads custom_reminders table and sends matching reminders
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendWhatsApp } from "../../_shared/messaging.ts";

interface Reminder {
  id: string;
  reminder_key: string;
  name: string;
  recipient_name: string;
  recipient_phone: string;
  schedule_type: "monthly_dates" | "nth_weekday";
  month_days: number[] | null;
  weekday: number | null;
  weekday_occurrence: number | null;
  schedule_time: string;       // "HH:MM"
  pre_saturday_friday: boolean;
  pre_saturday_time: string | null; // "HH:MM"
  message_body: string;
  link_url: string | null;
  is_active: boolean;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function hhmm(d: Date) { return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }

function shouldFire(r: Reminder, nowIL: Date): { fire: boolean; isPreSat: boolean; targetDay: number | null } {
  const day = nowIL.getUTCDate();
  const dow = nowIL.getUTCDay();
  const time = hhmm(nowIL);

  if (dow === 6) return { fire: false, isPreSat: false, targetDay: null }; // Saturday: never

  if (r.schedule_type === "monthly_dates") {
    const days = r.month_days || [];
    // Regular run on the day itself (skip if Saturday handled above)
    if (days.includes(day) && time === r.schedule_time) {
      return { fire: true, isPreSat: false, targetDay: day };
    }
    // Friday early-send: if tomorrow is Saturday and is a target day
    if (r.pre_saturday_friday && dow === 5 && time === (r.pre_saturday_time || "08:00")) {
      const tomorrow = new Date(nowIL.getTime() + 24 * 60 * 60 * 1000);
      const tDay = tomorrow.getUTCDate();
      if (tomorrow.getUTCDay() === 6 && days.includes(tDay)) {
        return { fire: true, isPreSat: true, targetDay: tDay };
      }
    }
    return { fire: false, isPreSat: false, targetDay: null };
  }

  if (r.schedule_type === "nth_weekday") {
    if (r.weekday === null || r.weekday_occurrence === null) return { fire: false, isPreSat: false, targetDay: null };
    if (dow !== r.weekday) return { fire: false, isPreSat: false, targetDay: null };
    if (time !== r.schedule_time) return { fire: false, isPreSat: false, targetDay: null };
    const occurrence = Math.ceil(day / 7);
    if (occurrence !== r.weekday_occurrence) return { fire: false, isPreSat: false, targetDay: null };
    return { fire: true, isPreSat: false, targetDay: day };
  }

  return { fire: false, isPreSat: false, targetDay: null };
}

function buildMessage(r: Reminder, isPreSat: boolean, targetDay: number | null): string {
  const greeting = `שלום ${r.recipient_name} 👋`;
  const header = isPreSat
    ? `תזכורת מוקדמת (ה-${targetDay} לחודש חל בשבת):`
    : `תזכורת:`;
  const link = r.link_url ? `\n\n🔗 לינק:\n${r.link_url}` : "";
  return `${greeting}\n\n${header}\n${r.message_body}${link}\n\nתודה!`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const { data: reminders, error } = await supabase
      .from("custom_reminders")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    const results: any[] = [];

    for (const r of (reminders as Reminder[])) {
      const { fire, isPreSat, targetDay } = shouldFire(r, nowIL);
      if (!fire) {
        results.push({ key: r.reminder_key, skipped: true });
        continue;
      }

      const message = buildMessage(r, isPreSat, targetDay);
      const res = await sendWhatsApp(r.recipient_phone, message);

      await supabase.from("whatsapp_log").insert({
        message_type: r.reminder_key,
        message_body: message,
        recipient_phone: r.recipient_phone,
        recipient_name: r.recipient_name,
        webhook_status: res.status,
      });

      results.push({ key: r.reminder_key, sent: true, status: res.status });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("custom-reminder-runner error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
