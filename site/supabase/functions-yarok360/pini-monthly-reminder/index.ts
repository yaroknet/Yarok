// Pini bi-monthly reminder (14th & 28th) - Castro & Super-Pharm table
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendWhatsApp } from "../../_shared/messaging.ts";

const PINI_PHONE = "0548944555";
const PINI_NAME = "פיני";
const SHEET_LINK = "https://docs.google.com/spreadsheets/d/1BOtLrAfBeY0L3MbuR28jhLoaoT6wXTJO/edit?gid=780937665#gid=780937665";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const day = nowIL.getUTCDate();
    const dow = nowIL.getUTCDay(); // 5=Fri, 6=Sat
    const hour = nowIL.getUTCHours();

    // Tomorrow (IL)
    const tomorrowIL = new Date(nowIL.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDay = tomorrowIL.getUTCDate();
    const tomorrowDow = tomorrowIL.getUTCDay();

    let targetDay: number | null = null;
    let isFridayPreSaturday = false;

    // Friday 08:00 — if Saturday will be 14 or 28, send today instead
    if (dow === 5 && hour === 8 && (tomorrowDow === 6) && (tomorrowDay === 14 || tomorrowDay === 28)) {
      targetDay = tomorrowDay;
      isFridayPreSaturday = true;
    }
    // Regular 17:00 run on the 14th or 28th, but skip if it's Saturday (handled by Friday)
    else if (hour === 17 && (day === 14 || day === 28) && dow !== 6) {
      targetDay = day;
    }

    if (targetDay === null) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_target_window", day, dow, hour }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prefix = isFridayPreSaturday
      ? `שלום ${PINI_NAME} 👋\n\nתזכורת מוקדמת (ה-${targetDay} לחודש חל בשבת):`
      : `שלום ${PINI_NAME} 👋\n\nתזכורת חודשית (${targetDay} לחודש):`;
    const message = `${prefix}\nנא למלא את הטבלה של *קסטרו* ו-*סופר פארם*.\n\n🔗 לינק לטבלה:\n${SHEET_LINK}\n\nתודה!`;

    const res = await sendWhatsApp(PINI_PHONE, message);

    // Log
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("whatsapp_log").insert({
      message_type: "pini_monthly_reminder",
      message_body: message,
      recipient_phone: PINI_PHONE,
      recipient_name: PINI_NAME,
      webhook_status: res.status,
    });

    return new Response(JSON.stringify({ success: true, day, status: res.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pini-monthly-reminder error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
