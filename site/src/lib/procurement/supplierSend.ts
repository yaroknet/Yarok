import { supabase } from '@/integrations/supabase/client';

export type SupplierEventType = 'order_created' | 'order_updated' | 'order_cancelled';

export interface SupplierSendResult {
  success: boolean;
  edge_function_invoked: boolean;
  http_status?: number | null;
  error_name?: string | null;
  error_message?: string | null;
  message?: string;
  failure_stage?: string | null;
  sent_emails?: string[];
}

export interface OrderPdfRef {
  supplierId: string;
  fileName: string;
  storagePath: string;
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
export async function uploadOrderPdf(params: {
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
  const storedSize = Number((found as { metadata?: { size?: number } }).metadata?.size ?? 0);
  if (!storedSize) throw new Error('pdf_verify_failed: הקובץ נשמר ריק ב־Storage');
  return { path, size: storedSize, displayFileName: params.fileName };
}

/** Emails the order PDFs to the suppliers (server function; checks the user is a manager) */
export async function sendOrderToSuppliers(params: {
  orderId: string;
  eventType: SupplierEventType;
  orderVersion: number;
  pdfs: OrderPdfRef[];
  versionId?: string | null;
  finalStatus?: string | null;
  allowResend?: boolean;
}): Promise<SupplierSendResult> {
  const { data, error } = await supabase.functions.invoke('procurement-send', {
    body: { action: 'send_order', ...params },
  });
  if (error) {
    // Non-2xx answers still carry the failure details in the body
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    if (body && typeof body === 'object' && 'edge_function_invoked' in body) return body as SupplierSendResult;
    return {
      success: false,
      edge_function_invoked: false,
      failure_stage: 'request_not_started',
      error_name: 'edge_function_invoke_failed',
      error_message: error.message,
    };
  }
  return data as SupplierSendResult;
}
