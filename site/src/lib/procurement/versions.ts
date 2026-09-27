import { supabase } from '@/integrations/supabase/client';
import type { OrderSnapshot, SnapshotLine, DiffResult } from './diff';

const VAT = 0.17;

export function buildSnapshotFromLines(order: any, lines: any[], allSci: any[], version: number): OrderSnapshot {
  const snapLines: SnapshotLine[] = lines.map((l: any) => {
    const sci = allSci.find((s: any) => s.id === l.supplier_catalog_item_id);
    return {
      key: l.id,
      internal_item_id: l.internal_item_id,
      internal_name: l.internal_catalog_items?.name || null,
      supplier_catalog_item_id: l.supplier_catalog_item_id || null,
      supplier_id: l.supplier_id || sci?.supplier_id || null,
      supplier_name: sci?.suppliers?.name || null,
      supplier_sku: sci?.supplier_sku || l.supplier_sku || null,
      supplier_item_name: sci?.supplier_product_name || l.supplier_item_name || null,
      quantity: Number(l.quantity) || 0,
      pack_units: sci?.pack_size || l.pack_units || null,
      unit_price: sci?.unit_price ?? l.unit_price_snapshot ?? null,
      admin_note: l.admin_note || null,
      user_note: l.user_note || null,
    };
  });

  const subtotal = snapLines.reduce((s, l) => {
    const price = Number(l.unit_price) || 0;
    const pack = Math.max(1, Number(l.pack_units) || 1);
    const actual = Math.ceil(l.quantity / pack) * pack;
    return s + actual * price;
  }, 0);
  const vat = subtotal * VAT;

  return {
    order_number: order.order_number,
    version,
    billing_entity: order.billing_entity,
    client_name: order.clients?.name || null,
    site_name: order.shipping_addresses?.site_name || null,
    shipping_address: order.shipping_addresses?.address || null,
    contact_name: order.contact_name || order.shipping_addresses?.contact_name || null,
    contact_phone: order.contact_phone || order.shipping_addresses?.contact_phone || null,
    shipping_notes: order.shipping_notes || null,
    lines: snapLines,
    totals: { subtotal, vat, grand: subtotal + vat, vat_rate: 17 },
  };
}

export async function loadLatestVersion(orderId: string): Promise<any | null> {
  const { data } = await supabase
    .from('procurement_order_versions' as any)
    .select('*')
    .eq('order_id', orderId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function loadAllVersions(orderId: string): Promise<any[]> {
  const { data } = await supabase
    .from('procurement_order_versions' as any)
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return (data as any[]) || [];
}

export async function createVersion(params: {
  orderId: string;
  versionNumber: number;
  documentType: 'original' | 'update' | 'cancellation';
  snapshot: OrderSnapshot;
  changeSummary?: DiffResult | null;
  userId?: string | null;
}) {
  const { orderId, versionNumber, documentType, snapshot, changeSummary, userId } = params;
  const { data, error } = await supabase.from('procurement_order_versions' as any).insert({
    order_id: orderId,
    version_number: versionNumber,
    document_type: documentType,
    snapshot: snapshot as any,
    change_summary: (changeSummary as any) || null,
    created_by: userId || null,
    send_status: 'pending',
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function markVersionSent(versionId: string, params: { userId?: string | null; toEmails: string[]; pdfUrl?: string | null; filename?: string | null; }) {
  await supabase.from('procurement_order_versions' as any).update({
    send_status: 'sent',
    sent_at: new Date().toISOString(),
    sent_by: params.userId || null,
    sent_to: params.toEmails as any,
    pdf_url: params.pdfUrl || null,
    pdf_filename: params.filename || null,
  }).eq('id', versionId);
}

export async function markVersionFailed(versionId: string, err: string) {
  await supabase.from('procurement_order_versions' as any).update({
    send_status: 'failed',
    send_error: err.slice(0, 500),
  }).eq('id', versionId);
}
