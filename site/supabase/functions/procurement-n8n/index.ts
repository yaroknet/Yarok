import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEST_WEBHOOK_URL = "https://yarokcleaning.app.n8n.cloud/webhook-test/purchase-order-send";
const TIMEOUT_MS = 20_000;
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

async function postJsonWithTimeout(url: string, payload: unknown) {
  const started = new Date().toISOString();
  const startedMs = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    const completed = new Date().toISOString();
    return {
      success: response.ok,
      webhook_url: url,
      request_started_at: started,
      request_completed_at: completed,
      duration_ms: Date.now() - startedMs,
      http_status: response.status,
      response_body: text.slice(0, 4000),
      error_name: null as string | null,
      error_message: response.ok ? null : `HTTP ${response.status}`,
      timed_out: false,
    };
  } catch (error) {
    const completed = new Date().toISOString();
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    return {
      success: false,
      webhook_url: url,
      request_started_at: started,
      request_completed_at: completed,
      duration_ms: Date.now() - startedMs,
      http_status: null,
      response_body: null,
      error_name: isAbort ? "n8n_timeout" : error instanceof Error ? error.name : "unknown_error",
      error_message: isAbort ? "הבקשה ל־n8n חרגה מזמן ההמתנה." : error instanceof Error ? error.message : String(error),
      timed_out: isAbort,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function saveTechnicalLog(supabase: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  await supabase.from("procurement_n8n_logs").insert(row);
}

async function requireUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, isManager: false, isSuperAdmin: false };
  const token = authHeader.replace("Bearer ", "");
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) return { user: null, isManager: false, isSuperAdmin: false };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isSuperAdmin = (roles || []).some((r: { role: string }) => r.role === "super_admin");
  const isManager = isSuperAdmin || (roles || []).some((r: { role: string }) => r.role === "manager");
  return { user, isManager, isSuperAdmin };
}

async function configuredWebhookUrl(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "procurement.n8n_webhook_url")
    .maybeSingle();
  const raw = data?.setting_value;
  return typeof raw === "string" && raw.startsWith("https://") ? raw : TEST_WEBHOOK_URL;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { user, isManager, isSuperAdmin } = await requireUser(req, supabase);
    if (!user) return json({ success: false, error: "unauthorized", edge_function_invoked: true }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "connection_test") {
      if (!isSuperAdmin) return json({ success: false, error: "forbidden", edge_function_invoked: true }, 403);
      const payload = {
        eventType: "connection_test",
        source: "lovable_purchase_module",
        message: "Test connection from Lovable",
        sentAt: new Date().toISOString(),
      };
      const result = await postJsonWithTimeout(TEST_WEBHOOK_URL, payload);
      await saveTechnicalLog(supabase, {
        action: "n8n_connection_test",
        actor_id: user.id,
        webhook_url: TEST_WEBHOOK_URL,
        request_started_at: result.request_started_at,
        request_completed_at: result.request_completed_at,
        duration_ms: result.duration_ms,
        http_status: result.http_status,
        response_body: result.response_body,
        error_name: result.error_name,
        error_message: result.error_message,
        failure_stage: result.timed_out ? "n8n_timeout" : result.success ? null : "n8n_connection_failed",
        edge_function_invoked: true,
      });
      return json({
        ...result,
        success: result.success,
        edge_function_invoked: true,
        tested_at: new Date().toISOString(),
        message: result.success ? "Webhook reached successfully" : result.error_message,
      });
    }

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
          action: "n8n_send_failed",
          details: { stage, error: message, eventType, version: orderVersion, ...extra },
        });
        await saveTechnicalLog(supabase, {
          action: "n8n_send_order",
          order_id: orderId,
          actor_id: user.id,
          webhook_url: extra.webhook_url || TEST_WEBHOOK_URL,
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
      const webhookUrl = await configuredWebhookUrl(supabase);
      const sentEmails: string[] = [];
      let lastPdfName: string | null = null;
      let lastPdfUrl: string | null = null;

      for (const supplierId of supplierIds) {
        const supplier = suppliersById.get(supplierId) as { id: string; name: string; email?: string | null; contacts?: unknown } | undefined;
        if (!supplier) {
          await logFailure("supplier_not_found", "supplier_not_found", { supplierId, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "supplier_not_found", error_message: "supplier_not_found" }, 400);
        }
        const emails = extractEmails(supplier);
        if (!emails.length) {
          await logFailure("supplier_email_missing", "supplier_email_missing", { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "supplier_email_missing", error_message: "הספק אינו מכיל כתובות מייל פעילות. יש לעדכן אנשי קשר לפני שליחה." }, 400);
        }
        const pdf = pdfs.find((p: { supplierId?: string }) => p?.supplierId === supplierId);
        if (!pdf?.storagePath || !pdf?.fileName) {
          await logFailure("pdf_not_found", "לא הועבר קובץ PDF עבור הספק", { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: `לא נמצא PDF עבור הספק ${supplier.name}` }, 400);
        }

        // Verify the file actually exists in Storage before signing.
        const storagePath = String(pdf.storagePath);
        const folder = storagePath.substring(0, storagePath.lastIndexOf("/"));
        const filename = storagePath.substring(storagePath.lastIndexOf("/") + 1);
        const { data: listed, error: listErr } = await supabase.storage
          .from("purchase-order-attachments")
          .list(folder, { limit: 100, search: filename });
        if (listErr) {
          await logFailure("pdf_not_found", `storage list failed: ${listErr.message}`, { supplier: supplier.name, path: storagePath, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: `בדיקת קיום קובץ נכשלה: ${listErr.message}` }, 500);
        }
        const foundFile = (listed || []).find((f: { name: string; metadata?: { size?: number } }) => f.name === filename);
        if (!foundFile) {
          await logFailure("pdf_not_found", "PDF file missing in storage", { supplier: supplier.name, path: storagePath, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: `הקובץ לא נמצא ב־Storage: ${storagePath}` }, 404);
        }
        const fileSize = (foundFile as { metadata?: { size?: number } }).metadata?.size ?? 0;
        if (!fileSize) {
          await logFailure("pdf_not_found", "PDF file is empty", { supplier: supplier.name, path: storagePath, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "pdf_not_found", error_message: "הקובץ שנשמר ריק (0 בייטים)" }, 500);
        }

        const { data: signed, error: signErr } = await supabase.storage
          .from("purchase-order-attachments")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        if (signErr || !signed?.signedUrl) {
          await logFailure("signed_url_generation_failed", signErr?.message || "signed_url_generation_failed", { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "signed_url_generation_failed", error_message: signErr?.message || "signed_url_generation_failed" }, 500);
        }

        // Verify the signed URL is reachable (not 401/403/404) and returns a PDF.
        try {
          const head = await fetch(signed.signedUrl, { method: "GET", headers: { Range: "bytes=0-64" } });
          if (![200, 206].includes(head.status)) {
            await logFailure("signed_url_verification_failed", `HTTP ${head.status}`, { supplier: supplier.name, url_status: head.status, webhook_url: webhookUrl });
            return json({ success: false, edge_function_invoked: true, failure_stage: "signed_url_verification_failed", error_message: `הקישור המאובטח החזיר קוד ${head.status}` }, 502);
          }
          const ctype = head.headers.get("content-type") || "";
          if (!ctype.toLowerCase().includes("pdf") && !ctype.toLowerCase().includes("octet-stream")) {
            await logFailure("signed_url_verification_failed", `unexpected content-type ${ctype}`, { supplier: supplier.name, webhook_url: webhookUrl });
            return json({ success: false, edge_function_invoked: true, failure_stage: "signed_url_verification_failed", error_message: `סוג הקובץ בקישור אינו PDF (${ctype})` }, 502);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logFailure("signed_url_verification_failed", msg, { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ success: false, edge_function_invoked: true, failure_stage: "signed_url_verification_failed", error_message: `בדיקת הקישור המאובטח נכשלה: ${msg}` }, 502);
        }

        // Persist PDF metadata on the current version (upsert-safe update).
        if (versionId) {
          await supabase.from("procurement_order_versions").update({
            pdf_filename: String(pdf.fileName),
            pdf_url: signed.signedUrl,
          }).eq("id", versionId);
        }
        await supabase.from("procurement_order_activity").insert({
          order_id: orderId,
          actor_id: user.id,
          action: "n8n_signed_url_created",
          details: { supplier: supplier.name, path: storagePath, file: pdf.fileName, size: fileSize, version: orderVersion },
        });


        const content = emailContent(order.order_number, eventType);
        const payload = {
          eventType,
          orderId,
          orderNumber: order.order_number,
          orderVersion,
          supplier: {
            id: supplier.id,
            name: supplier.name,
            emails,
            contacts: Array.isArray(supplier.contacts)
              ? (supplier.contacts as Array<{ name?: string; email?: string; phone?: string }>).map((c) => ({
                  name: c?.name || null,
                  email: c?.email || null,
                  phone: c?.phone || null,
                }))
              : [],
          },
          site: {
            name: order.shipping_addresses?.site_name || null,
            address: order.shipping_addresses?.address || null,
            contactName: order.contact_name || order.shipping_addresses?.contact_name || null,
            contactPhone: order.contact_phone || order.shipping_addresses?.contact_phone || null,
          },
          company: COMPANY,
          pdf: { fileName: String(pdf.fileName), downloadUrl: signed.signedUrl },
          email: content,
        };

        const result = await postJsonWithTimeout(webhookUrl, payload);
        await saveTechnicalLog(supabase, {
          action: "n8n_send_order",
          order_id: orderId,
          actor_id: user.id,
          webhook_url: webhookUrl,
          request_started_at: result.request_started_at,
          request_completed_at: result.request_completed_at,
          duration_ms: result.duration_ms,
          http_status: result.http_status,
          response_body: result.response_body,
          error_name: result.error_name,
          error_message: result.error_message,
          failure_stage: result.timed_out ? "n8n_timeout" : result.success ? null : "n8n_connection_failed",
          edge_function_invoked: true,
        });
        if (result.timed_out) {
          await logFailure("n8n_timeout", result.error_message || "n8n_timeout", { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ ...result, success: false, edge_function_invoked: true, failure_stage: "n8n_timeout" }, 504);
        }
        if (!result.success) {
          await logFailure(result.http_status ? "n8n_error_response" : "n8n_connection_failed", result.error_message || "n8n_connection_failed", { supplier: supplier.name, webhook_url: webhookUrl });
          return json({ ...result, success: false, edge_function_invoked: true, failure_stage: result.http_status ? "n8n_error_response" : "n8n_connection_failed" }, 502);
        }
        try {
          const parsed = result.response_body ? JSON.parse(result.response_body) : {};
          if (parsed?.success === false) {
            await logFailure("n8n_error_response", parsed.message || "success_false", { supplier: supplier.name, webhook_url: webhookUrl });
            return json({ ...result, success: false, edge_function_invoked: true, failure_stage: "n8n_error_response", error_message: parsed.message || "success_false" }, 502);
          }
        } catch {
          // n8n test webhooks may return text/html; any 2xx still proves the event reached n8n.
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
        webhook_url: webhookUrl,
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