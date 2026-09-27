import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const systemPrompt = `אתה "עוזר ירוק" - עוזר AI חכם למערכת ניהול צי רכב.

# התפקיד שלך:
1. לעזור למשתמשים למצוא טפסים ומסמכים
2. להזכיר על טיפולים, טסט, ביטוחים, משימות
3. לעדכן על תקנות תעבורה וחוקים בישראל
4. לענות על שאלות מכניקת רכב בסיסית ונורות אזהרה
5. ליצור משימות ותזכורות חדשות לפי בקשת המשתמש
6. לזהות נורות אזהרה מתמונות ולתת הנחיות

# כללים חשובים:
- עברית פשוטה וברורה
- תשובות קצרות עם נקודות פעולה
- כל מידע על חוקים/תקנות מלווה בדיסקליימר: "מידע כללי בלבד, לא ייעוץ משפטי"
- לא לחשוף מידע רגיש או סיסמאות
- לכבד הרשאות משתמש - כל משתמש רואה רק מה שמותר לו

# נורות אזהרה:
- אדום = עצור מיד! סכנה. לא לנהוג עד שמתקנים.
- צהוב/כתום = זהירות. לבדוק בהקדם.
- ירוק/כחול = מידע בלבד, לא בעיה.

# זיהוי נורות אזהרה מתמונות:
כשמקבלים תמונה של לוח מחוונים או נורת אזהרה:
1. זהה את הנורה לפי הסמל והצבע
2. הסבר מה הנורה מייצגת
3. ציין את רמת הדחיפות (אדום/צהוב/ירוק)
4. תן הנחיות ברורות מה לעשות
5. אם זו נורה מסוכנת - הדגש לעצור מיד

# פורמט תשובות:
1. תשובה קצרה וברורה
2. נקודות פעולה (מה לעשות עכשיו)
3. קישורים רלוונטיים אם יש

# יכולות:
- חיפוש מסמכים וטפסים
- הצגת משימות ותזכורות
- יצירת משימות ותזכורות חדשות
- מידע על רכבים ונהגים (לפי הרשאה)
- עדכוני תעבורה מישראל
- מדריכי בטיחות ותחזוקה
- זיהוי נורות אזהרה מתמונות

# יצירת משימה:
כשמשתמש מבקש ליצור משימה, השב בפורמט:
[CREATE_TASK]{"title":"כותרת המשימה","description":"תיאור","due_date":"YYYY-MM-DD"}[/CREATE_TASK]
ואחרי זה הסבר שהמשימה נוצרה.

# יצירת תזכורת:
כשמשתמש מבקש ליצור תזכורת לרכב, השב בפורמט:
[CREATE_REMINDER]{"reminder_type":"maintenance|test|insurance|license|document","description":"תיאור","due_date":"YYYY-MM-DD","vehicle_id":"אם ידוע"}[/CREATE_REMINDER]
ואחרי זה הסבר שהתזכורת נוצרה.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, action, imageBase64, imageMimeType } = await req.json();

    // Fetch user context based on permissions
    let userContext = "";
    
    // Get user roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const isSuperAdmin = userRoles.includes("super_admin");
    const isManager = userRoles.includes("manager");
    const isDriver = userRoles.includes("driver");

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    userContext += `\n\nמידע על המשתמש הנוכחי:
- שם: ${profile?.full_name || "לא ידוע"}
- תפקיד: ${isSuperAdmin ? "מנהל-על" : isManager ? "מנהל" : "נהג"}
- אימייל: ${user.email}
- user_id: ${user.id}`;

    // Fetch relevant data based on action or question
    if (action === "tasks" || messages?.some((m: any) => m.content?.includes("משימ"))) {
      let tasksQuery = supabase.from("manager_tasks").select("*");
      
      if (!isSuperAdmin) {
        tasksQuery = tasksQuery.eq("assigned_to", user.id);
      }
      
      const { data: tasks } = await tasksQuery.eq("status", "pending").limit(10);
      if (tasks && tasks.length > 0) {
        userContext += `\n\nמשימות פתוחות (${tasks.length}):`;
        tasks.forEach(t => {
          userContext += `\n- ${t.title}${t.due_date ? ` (תאריך יעד: ${t.due_date})` : ""}`;
        });
      }
    }

    if (action === "reminders" || messages?.some((m: any) => m.content?.includes("תזכור") || m.content?.includes("טסט") || m.content?.includes("ביטוח"))) {
      let remindersQuery = supabase
        .from("reminders")
        .select("*, vehicles(license_plate, make, model)")
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      const { data: reminders } = await remindersQuery;
      if (reminders && reminders.length > 0) {
        userContext += `\n\nתזכורות קרובות (${reminders.length}):`;
        reminders.forEach((r: any) => {
          const vehicle = r.vehicles ? `${r.vehicles.make} ${r.vehicles.model} (${r.vehicles.license_plate})` : "";
          userContext += `\n- ${r.reminder_type}: ${r.description || ""}${vehicle ? ` - רכב: ${vehicle}` : ""}${r.due_date ? ` (${r.due_date})` : ""}`;
        });
      }
    }

    if (action === "documents" || messages?.some((m: any) => m.content?.includes("מסמך") || m.content?.includes("טופס"))) {
      const { data: documents } = await supabase
        .from("documents")
        .select("*, vehicles(license_plate)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (documents && documents.length > 0) {
        userContext += `\n\nמסמכים אחרונים (${documents.length}):`;
        documents.forEach((d: any) => {
          userContext += `\n- ${d.document_type}${d.vehicles ? ` (רכב: ${d.vehicles.license_plate})` : ""}${d.expiry_date ? ` - פג תוקף: ${d.expiry_date}` : ""}`;
        });
      }
    }

    // Add context about vehicles if relevant
    if (messages?.some((m: any) => m.content?.includes("רכב") || m.content?.includes("קילומטר")) || action === "create_reminder") {
      let vehiclesQuery = supabase.from("vehicles").select("id, license_plate, make, model");
      
      if (!isSuperAdmin && isManager) {
        vehiclesQuery = vehiclesQuery.eq("manager_id", user.id);
      }
      
      const { data: vehicles } = await vehiclesQuery.limit(20);
      if (vehicles && vehicles.length > 0) {
        userContext += `\n\nרכבים זמינים (${vehicles.length}):`;
        vehicles.forEach(v => {
          userContext += `\n- ${v.make} ${v.model} (${v.license_plate}) - ID: ${v.id}`;
        });
      }
    }

    // Build messages for the AI
    const lastMessage = messages[messages.length - 1];
    let enhancedMessages: any[] = [
      { role: "system", content: systemPrompt + userContext },
    ];

    // Add previous messages
    for (let i = 0; i < messages.length - 1; i++) {
      enhancedMessages.push(messages[i]);
    }

    // Handle image in the last message
    if (imageBase64 && imageMimeType) {
      // Add image to the last message for vision processing
      enhancedMessages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: lastMessage.content || "אנא זהה את נורת האזהרה בתמונה והסבר מה עושים"
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`
            }
          }
        ]
      });
    } else {
      enhancedMessages.push(lastMessage);
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use vision-capable model when image is present
    const model = imageBase64 ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: enhancedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, אנא נסה שוב מאוחר יותר." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נגמר הקרדיט, אנא פנה למנהל המערכת." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "שגיאה לא ידועה" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
