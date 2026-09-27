// Compare two order snapshots and return a structured diff + Hebrew summary.

export interface SnapshotLine {
  key: string; // internal_item_id + supplier_catalog_item_id fallback
  internal_item_id?: string | null;
  internal_name?: string | null;
  supplier_catalog_item_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_sku?: string | null;
  supplier_item_name?: string | null;
  quantity: number;
  pack_units?: number | null;
  unit_price?: number | null;
  admin_note?: string | null;
  user_note?: string | null;
}

export interface OrderSnapshot {
  order_number: string;
  version: number;
  billing_entity?: string | null;
  client_name?: string | null;
  site_name?: string | null;
  shipping_address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  shipping_notes?: string | null;
  lines: SnapshotLine[];
  totals?: { subtotal: number; vat: number; grand: number; vat_rate: number };
}

export interface DiffResult {
  added: SnapshotLine[];
  removed: SnapshotLine[];
  quantityChanged: { line: SnapshotLine; from: number; to: number }[];
  supplierChanged: { line: SnapshotLine; from?: string | null; to?: string | null }[];
  skuChanged: { line: SnapshotLine; from?: string | null; to?: string | null }[];
  priceChanged: { line: SnapshotLine; from?: number | null; to?: number | null }[];
  shippingChanged: boolean;
  notesChanged: boolean;
  hasChanges: boolean;
  primaryKind: 'added' | 'removed' | 'quantity' | 'mixed' | 'none';
}

function lineKey(l: SnapshotLine): string {
  return l.internal_item_id || l.key || `${l.internal_name}::${l.supplier_sku}`;
}

export function diffSnapshots(prev: OrderSnapshot, next: OrderSnapshot): DiffResult {
  const prevMap = new Map(prev.lines.map(l => [lineKey(l), l]));
  const nextMap = new Map(next.lines.map(l => [lineKey(l), l]));

  const added: SnapshotLine[] = [];
  const removed: SnapshotLine[] = [];
  const quantityChanged: DiffResult['quantityChanged'] = [];
  const supplierChanged: DiffResult['supplierChanged'] = [];
  const skuChanged: DiffResult['skuChanged'] = [];
  const priceChanged: DiffResult['priceChanged'] = [];

  for (const [k, n] of nextMap) {
    const p = prevMap.get(k);
    if (!p) { added.push(n); continue; }
    if (Number(p.quantity) !== Number(n.quantity)) quantityChanged.push({ line: n, from: Number(p.quantity), to: Number(n.quantity) });
    if ((p.supplier_id || null) !== (n.supplier_id || null)) supplierChanged.push({ line: n, from: p.supplier_name, to: n.supplier_name });
    if ((p.supplier_sku || null) !== (n.supplier_sku || null)) skuChanged.push({ line: n, from: p.supplier_sku, to: n.supplier_sku });
    if (Number(p.unit_price || 0) !== Number(n.unit_price || 0)) priceChanged.push({ line: n, from: p.unit_price, to: n.unit_price });
  }
  for (const [k, p] of prevMap) if (!nextMap.has(k)) removed.push(p);

  const shippingChanged =
    (prev.site_name || '') !== (next.site_name || '') ||
    (prev.shipping_address || '') !== (next.shipping_address || '') ||
    (prev.contact_name || '') !== (next.contact_name || '') ||
    (prev.contact_phone || '') !== (next.contact_phone || '');
  const notesChanged = (prev.shipping_notes || '') !== (next.shipping_notes || '');

  const hasChanges =
    added.length > 0 || removed.length > 0 || quantityChanged.length > 0 ||
    supplierChanged.length > 0 || skuChanged.length > 0 || priceChanged.length > 0 ||
    shippingChanged || notesChanged;

  const kinds: string[] = [];
  if (added.length) kinds.push('added');
  if (removed.length) kinds.push('removed');
  if (quantityChanged.length) kinds.push('quantity');
  const primaryKind: DiffResult['primaryKind'] =
    !hasChanges ? 'none' :
    kinds.length > 1 ? 'mixed' :
    kinds.length === 1 ? (kinds[0] as any) :
    'mixed';

  return { added, removed, quantityChanged, supplierChanged, skuChanged, priceChanged, shippingChanged, notesChanged, hasChanges, primaryKind };
}

export function summarizeDiffHebrew(d: DiffResult): string {
  const parts: string[] = [];
  if (d.added.length) {
    parts.push('נוספו:\n' + d.added.map(l => `• ${l.internal_name || l.supplier_item_name || ''} — ${l.quantity}`).join('\n'));
  }
  if (d.removed.length) {
    parts.push('הוסרו:\n' + d.removed.map(l => `• ${l.internal_name || l.supplier_item_name || ''} — ${l.quantity}`).join('\n'));
  }
  if (d.quantityChanged.length) {
    parts.push('עודכנו כמויות:\n' + d.quantityChanged.map(c => `• ${c.line.internal_name || ''} — מ־${c.from} ל־${c.to}`).join('\n'));
  }
  if (d.supplierChanged.length) {
    parts.push('שונו ספקים:\n' + d.supplierChanged.map(c => `• ${c.line.internal_name || ''} — ${c.from || '—'} → ${c.to || '—'}`).join('\n'));
  }
  if (d.skuChanged.length) {
    parts.push('שונו מק״טים:\n' + d.skuChanged.map(c => `• ${c.line.internal_name || ''} — ${c.from || '—'} → ${c.to || '—'}`).join('\n'));
  }
  if (d.priceChanged.length) {
    parts.push('שונו מחירים:\n' + d.priceChanged.map(c => `• ${c.line.internal_name || ''} — ₪${Number(c.from || 0).toFixed(2)} → ₪${Number(c.to || 0).toFixed(2)}`).join('\n'));
  }
  if (d.shippingChanged) parts.push('עודכנו פרטי משלוח.');
  if (d.notesChanged) parts.push('עודכנו הערות שילוח.');
  return parts.join('\n\n') || 'ללא שינויים';
}

export function updateBannerText(kind: DiffResult['primaryKind']): string {
  switch (kind) {
    case 'added': return 'שים לב: ההזמנה עודכנה ונוספו אליה מוצרים. יש לפעול לפי הגרסה המצורפת בלבד.';
    case 'removed': return 'שים לב: ההזמנה עודכנה וחלק מהמוצרים הוסרו. אין לספק מוצרים שאינם מופיעים בגרסה זו.';
    case 'quantity': return 'שים לב: ההזמנה עודכנה וחלו שינויים בכמויות. יש להתייחס לגרסה המצורפת כגרסה הקובעת.';
    case 'mixed': return 'שים לב: זוהי הזמנה מעודכנת. נוספו, הוסרו או שונו מוצרים. גרסה זו מחליפה את הגרסה הקודמת ויש לפעול לפיה בלבד.';
    default: return 'הזמנה מעודכנת.';
  }
}
