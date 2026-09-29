// Sends purchase orders / updates / cancellations to the suppliers by email (company mailbox),
// with the order PDF attached and a secure download link.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { emailButton, emailDetails, emailLayout, sendEmail, textToHtml, toBase64 } from "../../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "purchase-order-attachments";
const COMPANY = {
  name: 'ירוק שירותי אחזקה ניקיון וכח אדם בע"מ',
  companyNumber: "514854116",
};

type EventType = "order_created" | "order_updated" | "order_cancelled";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /.+@.+\..+/.test(email) ? email : null;
}

function extractEmails(supplier: { email?: string | null; contacts?: unknown }) {
  const out = new Set<string>();
  if (Array.isArray(supplier.contacts)) {
    for (const contact of supplier.contacts as Array<{ email?: string | null }>) {
      const email = validEmail(contact?.email);
      if (email) out.add(email);
    }
  }
  const primary = validEmail(supplier.email);
  if (primary) out.add(primary);
  return [...out];
}

function emailContent(orderNumber: string, eventType: EventType) {
  if (eventType === "order_cancelled") {
    return {
      subject: `ביטול הזמנת רכש ${orderNumber} – ${COMPANY.name}`,
      message: `שלום,\n\nהודעה על ביטול הזמנת רכש ${orderNumber}.\nמצורף מסמך ביטול רשמי.\n\nבברכה,\n${COMPANY.name}`,
    };
  }
  if (eventType === "order_updated") {
    return {
      subject: `עדכון הזמנת רכש ${orderNumber} – ${COMPANY.name}`,
      message: `שלום,\n\nמצורפת גרסה מעודכנת של הזמנת רכש ${orderNumber}.\nנא לאשר קבלת העדכון.\n\nבברכה,\n${COMPANY.name}`,
    };
  }
  return {
    subject: `הזמנת רכש ${orderNumber} – ${COMPANY.name}`,
    message: `שלום,\n\nמצורפת הזמנת רכש.\nנא לאשר קבלת ההזמנה.\n\nבברכה,\n${COMPANY.name}`,
  };
}

// Technical log of each send attempt (table kept from the earlier automation integration)
async function saveTechnicalLog(supabase: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  await supabase.from("procurement_n8n_logs").insert(row);
}

async function requireUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, isManager: false };
  const token = authHeader.replace("Bearer ", "");
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) return { user: null, isManager: false };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isManager = (roles || []).some((r: { role: string }) => r.role === "super_admin" || r.role === "manager");
  return { user, isManager };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { user, isManager } = await requireUser(req, supabase);
    if (!user) return json({ success: false, error: "unauthorized", edge_function_invoked: true }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "send_order") {
      if (!isManager) return json({ success: false, error: "forbidden", edge_function_invoked: true }, 403);
      const orderId = String(body?.orderId || "");
      const eventType = body?.eventType as EventType;
      const pdfs = Array.isArray(body?.pdfs) ? body.pdfs : [];
      const orderVersion = Number(body?.orderVersion || 1);
      const finalStatus = body?.finalStatus ? String(body.finalStatus) : null;
      const versionId = body?.versionId ? String(body.versionId) : null;
      const allowResend = Boolean(body?.allowResend);

      if (!orderId || !["order_created", "order_updated", "order_cancelled"].includes(eventType)) {
        return json({ success: false, edge_function_invoked: true, failure_stage: "invalid_request", error_message: "invalid_request" }, 400);
      }

      const logFailure = async (stage: string, message: string, extra: Record<string, unknown> = {}) => {
        await supabase.from("procurement_order_activity").insert({
          order_id: orderId,
          actor_id: user.id,
          action: "supplier_send_failed",
          details: { stage, error: message, eventType, version: orderVersion, ...extra },
        });
        await saveTechnicalLog(supabase, {
          action: "email_send_order",
          order_id: orderId,
          actor_id: user.id,
          webhook_url: String(extra.recipients || "email"),
          request_started_at: new Date().toISOString(),
          request_completed_at: new Date().toISOString(),
          error_name: stage,
          error_message: message,
          failure_stage: stage,
          edge_function_invoked: true,
        });
      };

      const { data: order, error: orderErr } = await supabase
        .from("procurement_orders")
        .select("*, clients(name), shipping_addresses(*)")
        .eq("id", orderId)
        .maybeSingle();
      if (orderErr || !order) {
        await logFailure("order_not_found", orderErr?.message || "order_not_found");
        return json({ success: false, edge_function_invoked: true, failure_stage: "order_not_found", error_message: "order_not_found" }, 404);
      }
      if (!["approved", "pending_update_send", "edited_after_send", "send_failed", "sent_to_supplier", "update_sent", "cancelled"].includes(order.status)) {
        await logFailure("order_not_approved", `status=${order.status}`);
        return json({ success: false, edge_function_invoked: true, failure_stage: "order_not_approved", error_message: "קיימת הזמנה לא מאושרת" }, 400);
      }
      if (versionId && !allowResend) {
        const { data: version } = await supabase.from("procurement_order_versions").select("send_status").eq("id", versionId).maybeSingle();
        if (version?.send_status === "sent") {
          return json({ success: false, edge_function_invoked: true, failure_stage: "already_sent", error_message: "הזמנה זו כבר נשלחה לספק." }, 409);
        }
      }

      const { data: orderLines } = await supabase.from("procurement_order_lines").select("id,supplier_id").eq("order_id", orderId);
      const supplierIds = [...new Set((orderLines || []).map((l: { supplier_id: string | null }) => l.supplier_id).filter(Boolean))] as string[];
      if (!supplierIds.length) {
        await logFailure("supplier_not_found", "supplier_not_found");
        return json({ success: false, edge_function_invoked: true, failure_stage: "supplier_not_found", error_message: "supplier_not_found" }, 400);
      }
      const { data: suppliers } = await supabase.from("suppliers").select("id,name,email,contacts").in("id", supplierIds);
      const suppliersById = new Map((suppliers || []).map((s: { id: string }) => [s.id, s]));
      const sentEmails: string[] = [];
      let lastPdfName: string | null = null;
      let lastPdfUrl: string | null = null;

      for (const supplierId of supplierIds) {
        const supplier = suppliersById.get(supplierId) as { id: string; name: string; email?: string | null; contacts?: unknown } | undefined;
        if (!supplier) {
          await logFailure("supplier_not_found", "supplier_not_found", { supplierId });
          return json({ success: false, edge_function_invoked: true, failure_stage: "supplier_not_found", error_message: "supplier_not_found" }, 400);
        }
        const emails = extractEmails(supplier);
        if (!emails.length) {
          await logFailure("supplier_email_missing", "supplier_email_missing", { supplier: supplier.name });
          return json({ success: false, edge_function_invoked: true, failure_stage: "supplier_email_missing", error_message: "הספק אינו מכיל כתובות מייל פעילות. יש לעדכן אנשי קשר לפני שליחה." }, 400);
        }
        const pdf = pdfs.find((p: { supplierId?: string }) => p?.supplierId === supplierId);
        if (!pdf?.storagePath || !pdf?.fileName) {
          await logFailure("pdf_not_found", "לא הועבר קובץ PDF עבור הספק", { supplier: supplier.name });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: `לא נמצא PDF עבור הספק ${supplier.name}` }, 400);
        }

        // Read the saved PDF from storage; it is attached to the email
        const storagePath = String(pdf.storagePath);
        const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
        if (dlErr || !file) {
          await logFailure("pdf_not_found", `PDF file missing in storage: ${dlErr?.message ?? ""}`, { supplier: supplier.name, path: storagePath });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: `הקובץ לא נמצא ב־Storage: ${storagePath}` }, 404);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!bytes.length) {
          await logFailure("pdf_not_found", "PDF file is empty", { supplier: supplier.name, path: storagePath });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: "הקובץ שנשמר ריק (0 בייטים)" }, 500);
        }

        // 7-day download link, shown in the email and kept on the version
        const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        if (signErr || !signed?.signedUrl) {
          await logFailure("signed_url_generation_failed", signErr?.message || "signed_url_generation_failed", { supplier: supplier.name });
          return json({ success: false, edge_function_invoked: true, failure_stage: "signed_url_generation_failed", error_message: signErr?.message || "signed_url_generation_failed" }, 500);
        }

        if (versionId) {
          await supabase.from("procurement_order_versions").update({
            pdf_filename: String(pdf.fileName),
            pdf_url: signed.signedUrl,
          }).eq("id", versionId);
        }
        await supabase.from("procurement_order_activity").insert({
          order_id: orderId,
          actor_id: user.id,
          action: "pdf_link_created",
          details: { supplier: supplier.name, path: storagePath, file: pdf.fileName, size: bytes.length, version: orderVersion },
        });

        const content = emailContent(order.order_number, eventType);
        const site = order.shipping_addresses || {};
        const html = emailLayout(
          content.subject,
          `${textToHtml(content.message)}
${emailDetails([
  ["מספר הזמנה", order.order_number],
  ["גרסה", orderVersion > 1 ? orderVersion : null],
  ["ספק", supplier.name],
  ["אתר אספקה", site.site_name],
  ["כתובת", site.address],
  ["איש קשר באתר", order.contact_name || site.contact_name],
  ["טלפון איש קשר", order.contact_phone || site.contact_phone],
  ["ח.פ המזמין", COMPANY.companyNumber],
])}
${emailButton(signed.signedUrl, "להורדת המסמך (PDF)")}`,
        );

        const started = new Date().toISOString();
        const startedMs = Date.now();
        const sent = await sendEmail({
          to: emails,
          subject: content.subject,
          html,
          text: `${content.message}\n\nלהורדת המסמך: ${signed.signedUrl}`,
          attachments: [{ filename: String(pdf.fileName), content: toBase64(bytes), contentType: "application/pdf" }],
        });
        await saveTechnicalLog(supabase, {
          action: "email_send_order",
          order_id: orderId,
          actor_id: user.id,
          webhook_url: emails.join(", "),
          request_started_at: started,
          request_completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedMs,
          http_status: sent.status,
          response_body: sent.dryRun ? "dry run" : (sent.id ?? null),
          error_name: sent.ok ? null : "email_send_failed",
          error_message: sent.ok ? null : sent.error ?? `status ${sent.status}`,
          failure_stage: sent.ok ? null : "email_send_failed",
          edge_function_invoked: true,
        });
        if (!sent.ok) {
          await logFailure("email_send_failed", sent.error || "email_send_failed", { supplier: supplier.name, recipients: emails.join(", ") });
          return json({ success: false, edge_function_invoked: true, failure_stage: "email_send_failed", http_status: sent.status, error_message: sent.error || "email_send_failed" }, 502);
        }
        sentEmails.push(...emails);
        lastPdfName = String(pdf.fileName);
        lastPdfUrl = signed.signedUrl;
        await supabase.from("procurement_order_activity").insert({
          order_id: orderId,
          actor_id: user.id,
          action: "email_sent",
          details: { supplier: supplier.name, emails, pdf_file: pdf.fileName, version: orderVersion, eventType },
        });
      }

      if (versionId) {
        await supabase.from("procurement_order_versions").update({
          send_status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          sent_to: sentEmails,
          pdf_url: lastPdfUrl,
          pdf_filename: lastPdfName,
        }).eq("id", versionId);
      }
      if (finalStatus) {
        const patch: Record<string, unknown> = { status: finalStatus };
        if (finalStatus === "sent_to_supplier") patch.sent_to_supplier_at = new Date().toISOString();
        await supabase.from("procurement_orders").update(patch).eq("id", orderId);
        await supabase.from("procurement_order_activity").insert({
          order_id: orderId,
          actor_id: user.id,
          action: `status_change:${finalStatus}`,
          from_status: order.status,
          to_status: finalStatus,
          details: { sent_to: sentEmails, version: orderVersion, pdf_file: lastPdfName },
        });
      }

      return json({
        success: true,
        edge_function_invoked: true,
        sent_emails: sentEmails,
        pdf_file: lastPdfName,
        message: "Email sent successfully",
      });
    }

    return json({ success: false, error: "unknown_action", edge_function_invoked: true }, 400);
  } catch (error) {
    return json({
      success: false,
      edge_function_invoked: true,
      error_name: error instanceof Error ? error.name : "unknown_error",
      error_message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
