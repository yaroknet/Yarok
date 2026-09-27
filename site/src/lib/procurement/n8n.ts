import { supabase } from '@/integrations/supabase/client';

const DEFAULT_WEBHOOK_URL = 'https://yarokcleaning.app.n8n.cloud/webhook-test/purchase-order-send';
const COMPANY = {
  name: 'ירוק שירותי אחזקה ניקיון וכח אדם בע"מ',
  companyNumber: '514854116',
};

let cachedWebhook: string | null = null;

export async function getN8nWebhookUrl(): Promise<string> {
  if (cachedWebhook) return cachedWebhook;
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'procurement.n8n_webhook_url')
    .maybeSingle();
  const val = (data?.setting_value as unknown as string) || DEFAULT_WEBHOOK_URL;
  cachedWebhook = typeof val === 'string' ? val : DEFAULT_WEBHOOK_URL;
  return cachedWebhook;
}

export interface N8nSupplierContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface N8nSendPayload {
  eventType: 'order_created' | 'order_updated' | 'order_cancelled';
  orderId: string;
  orderNumber: string;
  orderVersion: number;
  supplier: {
    id: string;
    name: string;
    emails: string[];
    contacts: N8nSupplierContact[];
  };
  site: {
    name: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
  company: typeof COMPANY;
  pdf: {
    fileName: string;
    downloadUrl: string;
  };
  email: {
    subject: string;
    message: string;
  };
}

export interface N8nSendResult {
  success: boolean;
  message?: string;
  orderId?: string;
  sentAt?: string;
  error?: string;
}

export interface N8nDiagnosticResult {
  success: boolean;
  edge_function_invoked: boolean;
  webhook_url?: string;
  http_status?: number | null;
  response_body?: string | null;
  error_name?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
  request_started_at?: string;
  request_completed_at?: string | null;
  tested_at?: string;
  message?: string;
}

export interface N8nOrderPdfRef {
  supplierId: string;
  fileName: string;
  storagePath: string;
}

export interface N8nOrderSendResponse extends N8nDiagnosticResult {
  failure_stage?: string | null;
  sent_emails?: string[];
  supplier_name?: string | null;
}

export function extractSupplierEmails(supplier: { email?: string | null; contacts?: unknown }): string[] {
  const out = new Set<string>();
  const contacts = Array.isArray(supplier.contacts) ? (supplier.contacts as N8nSupplierContact[]) : [];
  contacts.forEach((c) => {
    const e = (c?.email || '').toString().trim();
    if (e && /.+@.+\..+/.test(e)) out.add(e.toLowerCase());
  });
  const primary = (supplier.email || '').toString().trim();
  if (primary && /.+@.+\..+/.test(primary)) out.add(primary.toLowerCase());
  return [...out];
}

export function buildDefaultEmailContent(orderNumber: string, variant: N8nSendPayload['eventType']) {
  if (variant === 'order_cancelled') {
    return {
      subject: `ביטול הזמנת רכש ${orderNumber} – ${COMPANY.name}`,
      message: `שלום,\n\nהודעה על ביטול הזמנת רכש ${orderNumber}.\nמצורף מסמך ביטול רשמי.\n\nבברכה,\n${COMPANY.name}`,
    };
  }
  if (variant === 'order_updated') {
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

/**
 * Sanitize a value for safe use as a Supabase Storage object key segment.
 * Storage keys must be ASCII-safe (Supabase rejects Hebrew/spaces/quotes with "Invalid key").
 */
export function sanitizeStorageSegment(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

/**
 * Uploads a PDF blob to the private `purchase-order-attachments` bucket.
 *
 * `fileName` is the human-facing display name (may contain Hebrew) and is
 * NEVER used inside the Storage object key. The key is built from sanitized
 * ASCII-only parts: purchase-orders/{orderId}/v{version}/order-{safeNumber}-{ts}.pdf
 */
export async function uploadPdfForN8n(params: {
  orderId: string;
  orderNumber: string;
  version: number;
  fileName: string; // display name only (Hebrew allowed)
  blob: Blob;
}): Promise<{ path: string; size: number; displayFileName: string }> {
  const size = params.blob.size || 0;
  if (!size) throw new Error('pdf_empty: הקובץ שנוצר ריק (0 בייטים)');

  const safeOrderId = sanitizeStorageSegment(params.orderId);
  const safeOrderNumber = sanitizeStorageSegment(params.orderNumber) || 'order';
  const safeVersion = Number.isFinite(params.version) && params.version > 0 ? Math.floor(params.version) : 1;
  if (!safeOrderId) throw new Error('pdf_upload_failed: invalid orderId');

  const ts = Date.now();
  const path = `purchase-orders/${safeOrderId}/v${safeVersion}/order-${safeOrderNumber}-${ts}.pdf`;

  const { error: upErr } = await supabase.storage
    .from('purchase-order-attachments')
    .upload(path, params.blob, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw new Error(`pdf_upload_failed: ${upErr.message}`);

  // Verify the file actually exists (and is non-empty) after upload.
  const folder = path.substring(0, path.lastIndexOf('/'));
  const filename = path.substring(path.lastIndexOf('/') + 1);
  const { data: listed, error: listErr } = await supabase.storage
    .from('purchase-order-attachments')
    .list(folder, { limit: 100, search: filename });
  if (listErr) throw new Error(`pdf_verify_failed: ${listErr.message}`);
  const found = (listed || []).find((f) => f.name === filename);
  if (!found) throw new Error('pdf_verify_failed: הקובץ לא נמצא ב־Storage לאחר ההעלאה');
  const storedSize = ((found as any).metadata?.size ?? 0) as number;
  if (!storedSize) throw new Error('pdf_verify_failed: הקובץ נשמר ריק ב־Storage');
  return { path, size: storedSize, displayFileName: params.fileName };
}

export async function testN8nConnection(): Promise<N8nDiagnosticResult> {
  const { data, error } = await supabase.functions.invoke('procurement-n8n', {
    body: { action: 'connection_test' },
  });
  if (error) {
    return {
      success: false,
      edge_function_invoked: false,
      error_name: 'edge_function_invoke_failed',
      error_message: error.message,
      tested_at: new Date().toISOString(),
    };
  }
  return data as N8nDiagnosticResult;
}

export async function sendOrderToN8n(params: {
  orderId: string;
  eventType: N8nSendPayload['eventType'];
  orderVersion: number;
  pdfs: N8nOrderPdfRef[];
  versionId?: string | null;
  finalStatus?: string | null;
  allowResend?: boolean;
}): Promise<N8nOrderSendResponse> {
  const { data, error } = await supabase.functions.invoke('procurement-n8n', {
    body: { action: 'send_order', ...params },
  });
  if (error) {
    return {
      success: false,
      edge_function_invoked: false,
      failure_stage: 'n8n_request_not_started',
      error_name: 'edge_function_invoke_failed',
      error_message: error.message,
      tested_at: new Date().toISOString(),
    };
  }
  return data as N8nOrderSendResponse;
}

export { COMPANY as N8N_COMPANY };
