// Dafna monthly reminder - 3rd Thursday of each month
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendWhatsApp } from "../../_shared/messaging.ts";

const DAFNA_PHONE = "0587988352";
const DAFNA_NAME = "דפנה";
const SHEET_LINK = "https://docs.google.com/spreadsheets/d/1BOtLrAfBeY0L3MbuR28jhLoaoT6wXTJO/edit?gid=780937665#gid=780937665";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const nowIL = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const day = nowIL.getUTCDate();
    const dow = nowIL.getUTCDay(); // 4 = Thursday

    // Saturday block
    if (dow === 6) {
      return new Response(JSON.stringify({ skipped: true, reason: "saturday" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be Thursday
    if (dow !== 4) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_thursday", dow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be the 3rd Thursday → day of month is 15-21
    if (day < 15 || day > 21) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_third_thursday", day }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = `שלום ${DAFNA_NAME} 👋\n\nתזכורת חודשית (יום חמישי השלישי לחודש):\n\n1️⃣ לעשות *יישור קו* בטבלת הניקיונות *הרבעוניים* של סופר פארם.\n2️⃣ לעשות *יישור קו* בטבלת הניקיונות *החודשיים* של קסטרו.\n3️⃣ לעדכן את *מאיה* בכל בעיה.\n\n🔗 לינק לטבלה:\n${SHEET_LINK}\n\nתודה!`;

    const res = await sendWhatsApp(DAFNA_PHONE, message);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("whatsapp_log").insert({
      message_type: "dafna_monthly_reminder",
      message_body: message,
      recipient_phone: DAFNA_PHONE,
      recipient_name: DAFNA_NAME,
      webhook_status: res.status,
    });

    return new Response(JSON.stringify({ success: true, day, status: res.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dafna-monthly-reminder error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
