// Emails a task report (PDF made in the browser and saved in storage) to a client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailButton, emailLayout, escapeHtml, sendEmail, toBase64 } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_ROLES = ["super_admin", "office_manager"];
const BUCKET = "field-media";

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await supabase.auth.getUser(jwt);
    if (!auth?.user) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    if (!(roles || []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role))) return json({ error: "forbidden" }, 403);

    const { taskIds, pdfPath, recipientEmail } = await req.json();
    const to = String(recipientEmail || "").trim();
    if (!to) return json({ error: "יש להזין אימייל נמען" }, 400);
    if (!Array.isArray(taskIds) || !taskIds.length) return json({ error: "לא נבחרו משימות" }, 400);
    if (typeof pdfPath !== "string" || !pdfPath.startsWith("task_reports/") || pdfPath.includes("..")) {
      return json({ error: "invalid pdfPath" }, 400);
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, work_type, sides_required, due_date, status, branches(name, networks(name))")
      .in("id", taskIds);

    const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(pdfPath);
    if (dlErr || !file) return json({ error: `PDF not found: ${dlErr?.message ?? pdfPath}` }, 404);
    const pdfBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    const pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(pdfPath).data.publicUrl;

    const rows = (tasks || []).map((t: any) => ({
      network: t.branches?.networks?.name || "",
      branch: t.branches?.name || "",
      work_type: t.work_type || "",
      sides: t.sides_required ?? "",
      due: t.due_date || "",
      status: STATUS_LABELS[t.status] || t.status || "",
    }));
    const th = "padding:8px;border:1px solid #e5e7eb;background:#eef6f1;text-align:right";
    const td = "padding:8px;border:1px solid #e5e7eb;text-align:right";
    const table = `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:0 0 16px">
<tr><th style="${th}">רשת</th><th style="${th}">סניף</th><th style="${th}">סוג עבודה</th><th style="${th}">צדדים</th><th style="${th}">תאריך יעד</th><th style="${th}">סטטוס</th></tr>
${rows.map((r) => `<tr><td style="${td}">${escapeHtml(r.network)}</td><td style="${td}">${escapeHtml(r.branch)}</td><td style="${td}">${escapeHtml(r.work_type)}</td><td style="${td}">${escapeHtml(r.sides)}</td><td style="${td}">${escapeHtml(r.due)}</td><td style="${td}">${escapeHtml(r.status)}</td></tr>`).join("\n")}
</table>`;

    const subject = `דוח ביצוע משימות מקבוצת ירוק (${rows.length} משימות)`;
    const html = emailLayout(
      "דוח ביצוע משימות",
      `<p style="margin:0 0 16px">שלום,<br>מצורף דוח ביצוע עבור ${rows.length} משימות.</p>
${table}
${emailButton(pdfUrl, "להורדת הדוח (PDF)")}
<p style="margin:0">בברכה,<br>קבוצת ירוק</p>`,
    );
    const text = [
      "שלום,",
      `מצורף דוח ביצוע עבור ${rows.length} משימות.`,
      "",
      ...rows.map((r) => `• ${r.network} — ${r.branch} | ${r.work_type} | ${r.due} | ${r.status}`),
      "",
      `להורדת הדוח: ${pdfUrl}`,
      "",
      "בברכה,",
      "קבוצת ירוק",
    ].join("\n");

    const sent = await sendEmail({
      to,
      subject,
      html,
      text,
      attachments: [{ filename: "task-report.pdf", content: pdfBase64, contentType: "application/pdf" }],
    });
    if (!sent.ok) return json({ error: `שליחת המייל נכשלה: ${sent.error ?? sent.status}` }, 502);

    return json({ ok: true, recipient: to, tasks: rows.length });
  } catch (e) {
    console.error("send-task-report error:", e);
    return json({ error: String(e) }, 500);
  }
});
