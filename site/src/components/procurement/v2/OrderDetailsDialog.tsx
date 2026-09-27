import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { STATUS_LABEL, STATUS_VARIANT } from './OrdersList';
import { qualityLabel } from '@/lib/procurement/recommendations';
import { generateSupplierPdf } from '@/lib/procurement/pdf';
import { AddOrderLineDialog } from './AddOrderLineDialog';
import { OrderVersionsPanel } from './OrderVersionsPanel';
import { buildSnapshotFromLines, loadLatestVersion, createVersion } from '@/lib/procurement/versions';
import {
  sendOrderToN8n,
  testN8nConnection,
  uploadPdfForN8n,
  type N8nDiagnosticResult,
  type N8nSendPayload,
} from '@/lib/procurement/n8n';
import { diffSnapshots, summarizeDiffHebrew, updateBannerText, type OrderSnapshot } from '@/lib/procurement/diff';
import {
  FileDown, CheckCircle2, XCircle, RotateCcw, Send, Package, Save, Undo2,
  ChevronsUpDown, Scale, Eye, Plus, Trash2, AlertTriangle,
} from 'lucide-react';

const POST_SEND_STATUSES = ['sent_to_supplier', 'delivered', 'update_sent', 'edited_after_send', 'pending_update_send', 'send_failed'];
const MIN_ORDER_TOTAL = 500; // ILS, before VAT

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adminMode: boolean;
  onChanged?: () => void;
}

const VAT = 0.17;

type SCI = {
  id: string; supplier_id: string; supplier_sku: string | null;
  supplier_product_name: string | null; purchase_unit: string;
  pack_size: number; unit_price: number;
  quality: 'basic' | 'standard' | 'premium';
  active: boolean; internal_item_id: string | null;
  notes: string | null; suppliers?: { id: string; name: string } | null;
};

type DraftLine = {
  quantity: number;
  supplier_catalog_item_id: string | null;
  admin_note: string;
};

const norm = (s?: string | null) =>
  (s || '').toString().toLowerCase().replace(/[״"'`׳.\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim();

export const OrderDetailsDialog = ({ orderId, open, onOpenChange, adminMode, onChanged }: Props) => {
  const { user, isSuperAdmin } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [allSci, setAllSci] = useState<SCI[]>([]);
  const [clientMappings, setClientMappings] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState<Record<string, DraftLine>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compareLineId, setCompareLineId] = useState<string | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [versionsRefresh, setVersionsRefresh] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [versionsExist, setVersionsExist] = useState(false);
  const [n8nTesting, setN8nTesting] = useState(false);
  const [n8nResultOpen, setN8nResultOpen] = useState(false);
  const [n8nResult, setN8nResult] = useState<N8nDiagnosticResult | null>(null);

  const canManage = adminMode;

  const load = async () => {
    const [{ data: o }, { data: ls }, { data: sci }, { data: acts }] = await Promise.all([
      supabase.from('procurement_orders').select('*, clients(name), shipping_addresses(*)').eq('id', orderId).single(),
      supabase.from('procurement_order_lines').select('*, internal_catalog_items(name,unit_of_measure)').eq('order_id', orderId).order('sort_order'),
      supabase.from('supplier_catalog_items').select('id, supplier_id, supplier_sku, supplier_product_name, purchase_unit, pack_size, unit_price, quality, active, internal_item_id, notes, suppliers(id,name)').eq('active', true),
      supabase.from('procurement_order_activity').select('*, profiles!procurement_order_activity_actor_id_fkey(full_name)').eq('order_id', orderId).order('created_at', { ascending: false }),
    ]);
    let creatorName = '';
    if (o?.created_by) {
      const { data: p } = await supabase.from('profiles').select('full_name').eq('user_id', o.created_by).maybeSingle();
      creatorName = p?.full_name || '';
    }
    const orderWithCreator = o ? { ...o, creator: { full_name: creatorName } } : o;
    setOrder(orderWithCreator); setLines(ls || []); setAllSci((sci as any[]) || []); setAdminNotes(o?.admin_notes || '');
    setActivity(acts || []);
    // reset draft
    const d: Record<string, DraftLine> = {};
    (ls || []).forEach((l: any) => {
      d[l.id] = {
        quantity: Number(l.quantity),
        supplier_catalog_item_id: l.supplier_catalog_item_id || null,
        admin_note: l.admin_note || '',
      };
    });
    setDraft(d);
    if (o?.client_id && ls?.length) {
      const ids = [...new Set(ls.map((l: any) => l.internal_item_id))];
      const { data: cm } = await supabase.from('client_item_mappings').select('*').eq('client_id', o.client_id).in('internal_item_id', ids);
      setClientMappings((cm as any[]) || []);
    } else setClientMappings([]);

    const { count } = await supabase.from('procurement_order_versions' as any).select('id', { count: 'exact', head: true }).eq('order_id', orderId);
    setVersionsExist((count || 0) > 0);
  };
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, orderId]);

  const suppliersMap = useMemo(() => {
    const m = new Map<string, string>();
    allSci.forEach(s => { if (s.suppliers) m.set(s.suppliers.id, s.suppliers.name); });
    return m;
  }, [allSci]);

  const logActivity = async (action: string, fromStatus: string | null, toStatus: string | null, details: any = null) => {
    if (!user) return;
    await supabase.from('procurement_order_activity').insert({
      order_id: orderId, actor_id: user.id, action,
      from_status: fromStatus as any, to_status: toStatus as any, details,
    });
  };

  const showN8nResult = (result: N8nDiagnosticResult) => {
    setN8nResult(result);
    setN8nResultOpen(true);
  };

  const handleN8nConnectionTest = async () => {
    if (!isSuperAdmin) return;
    setN8nTesting(true);
    toast.loading('בודק חיבור n8n...', { id: 'n8n-test' });
    const result = await testN8nConnection();
    toast.dismiss('n8n-test');
    showN8nResult(result);
    if (result.success) toast.success('חיבור n8n הצליח');
    else if (result.error_name === 'n8n_timeout') toast.error('הבקשה ל־n8n חרגה מזמן ההמתנה.');
    else toast.error('חיבור n8n נכשל — ראה פירוט בחלון הבדיקה');
    setN8nTesting(false);
  };

  // Per line: linked options (via internal_item_id or client mapping), and similar (by name substring, not linked)
  const lineOptions = (line: any) => {
    const linked = allSci.filter(s => s.internal_item_id === line.internal_item_id);
    const mappingIds = new Set(clientMappings.filter(cm => cm.internal_item_id === line.internal_item_id).map(cm => cm.supplier_catalog_item_id));
    const mapped = allSci.filter(s => mappingIds.has(s.id) && !linked.find(l => l.id === s.id));
    const linkedIds = new Set([...linked, ...mapped].map(s => s.id));
    const target = norm(line.internal_catalog_items?.name);
    const tokens = target.split(' ').filter(t => t.length >= 2);
    const similar = tokens.length ? allSci.filter(s => {
      if (linkedIds.has(s.id)) return false;
      const hay = norm(s.supplier_product_name);
      return tokens.some(t => hay.includes(t));
    }) : [];
    return { linked: [...linked, ...mapped], similar };
  };

  // Effective total for a supplier catalog item given a requested qty
  const effTotal = (s: SCI, qty: number) => {
    const pack = Math.max(1, Number(s.pack_size) || 1);
    const packs = Math.ceil(qty / pack);
    const actual = packs * pack;
    const total = actual * Number(s.unit_price || 0);
    return { pack, packs, actual, overage: actual - qty, total };
  };

  // Per-supplier basket comparison: what the whole order would cost at each supplier.
  // No split recommendation — comparison only.
  const basket = useMemo(() => {
    if (!lines.length) return null;
    const supplierIds = [...new Set(allSci.map(s => s.supplier_id))];
    const currentTotal = lines.reduce((sum, l) => {
      const dr = draft[l.id]; const sci = allSci.find(x => x.id === dr?.supplier_catalog_item_id);
      return sci && dr ? sum + effTotal(sci, dr.quantity).total : sum;
    }, 0);

    const perSupplier = supplierIds.map(sid => {
      let total = 0;
      let overagePacks = 0, overageUnits = 0;
      const missing: string[] = []; const found: string[] = [];
      const chosen: Record<string, string> = {};
      lines.forEach(l => {
        const { linked } = lineOptions(l);
        const cand = linked.filter(s => s.supplier_id === sid && s.active !== false);
        const qty = draft[l.id]?.quantity || l.quantity;
        if (!cand.length) { missing.push(l.internal_catalog_items?.name || ''); return; }
        const best = cand.map(c => ({ c, e: effTotal(c, qty) })).sort((a, b) => a.e.total - b.e.total)[0];
        total += best.e.total;
        found.push(l.internal_catalog_items?.name || '');
        chosen[l.id] = best.c.id;
        if (best.e.overage > 0) { overagePacks++; overageUnits += best.e.overage; }
      });
      const canFulfillAll = missing.length === 0;
      return {
        supplier_id: sid,
        supplier_name: suppliersMap.get(sid) || '',
        total,
        totalWithVat: total * (1 + VAT),
        foundCount: found.length,
        missingCount: missing.length,
        missing,
        overagePacks,
        overageUnits,
        canFulfillAll,
        chosen,
        diff: currentTotal > 0 ? total - currentTotal : 0,
      };
    }).filter(x => x.foundCount > 0).sort((a, b) => {
      if (a.canFulfillAll !== b.canFulfillAll) return a.canFulfillAll ? -1 : 1;
      return a.totalWithVat - b.totalWithVat;
    });

    return { perSupplier, currentTotal, totalLines: lines.length };
  }, [lines, allSci, suppliersMap, draft, clientMappings]);

  const applySupplier = (supplierId: string) => {
    const s = basket?.perSupplier.find(x => x.supplier_id === supplierId); if (!s) return;
    const d = { ...draft };
    const missing: string[] = [];
    lines.forEach(l => {
      const sciId = s.chosen[l.id];
      if (sciId) d[l.id] = { ...d[l.id], supplier_catalog_item_id: sciId };
      else missing.push(l.internal_catalog_items?.name || '');
    });
    setDraft(d);
    if (missing.length) toast.warning(`נבחר ${s.supplier_name}. אין התאמה עבור: ${missing.join(', ')} — בחר ידנית.`);
    else toast.success(`נבחר ספק: ${s.supplier_name}`);
  };

  const isDirty = useMemo(() => {
    return lines.some(l => {
      const dr = draft[l.id]; if (!dr) return false;
      return dr.quantity !== Number(l.quantity)
        || (dr.supplier_catalog_item_id || null) !== (l.supplier_catalog_item_id || null)
        || (dr.admin_note || '') !== (l.admin_note || '');
    });
  }, [draft, lines]);

  // Reload full order + lines and return them (fresh) for snapshotting
  const fetchFresh = async () => {
    const { data: o } = await supabase.from('procurement_orders').select('*, clients(name), shipping_addresses(*)').eq('id', orderId).single();
    const { data: ls } = await supabase.from('procurement_order_lines').select('*, internal_catalog_items(name,unit_of_measure)').eq('order_id', orderId).order('sort_order');
    return { o, ls: ls || [] };
  };

  const nextVersionNumber = async (): Promise<number> => {
    const latest = await loadLatestVersion(orderId);
    return latest ? (latest.version_number || 1) + 1 : 1;
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const isPostSend = POST_SEND_STATUSES.includes(order.status);

      // Snapshot BEFORE (only needed for post-send edit diffing)
      let prevSnap: OrderSnapshot | null = null;
      if (isPostSend) {
        const latest = await loadLatestVersion(orderId);
        if (latest?.snapshot) prevSnap = latest.snapshot as OrderSnapshot;
        else prevSnap = buildSnapshotFromLines(order, lines, allSci as any, 0);
      }

      for (const l of lines) {
        const dr = draft[l.id]; if (!dr) continue;
        const sci = allSci.find(s => s.id === dr.supplier_catalog_item_id);
        const patch: any = {
          quantity: dr.quantity,
          admin_note: dr.admin_note || null,
          supplier_catalog_item_id: sci?.id || null,
          supplier_id: sci?.supplier_id || null,
          unit_price_snapshot: sci?.unit_price || null,
          line_total_snapshot: sci ? effTotal(sci, dr.quantity).total : null,
          last_edited_by: user?.id || null,
          last_edited_at: now,
        };
        await supabase.from('procurement_order_lines').update(patch).eq('id', l.id);
      }
      await supabase.from('procurement_orders').update({ admin_notes: adminNotes || null }).eq('id', orderId);
      await logActivity('lines_saved', order.status, order.status, null);

      if (isPostSend && prevSnap) {
        const { o, ls } = await fetchFresh();
        const nextVer = await nextVersionNumber();
        const nextSnap = buildSnapshotFromLines(o, ls, allSci as any, nextVer);
        const d = diffSnapshots(prevSnap, nextSnap);
        if (d.hasChanges) {
          await createVersion({
            orderId, versionNumber: nextVer, documentType: 'update',
            snapshot: nextSnap, changeSummary: d, userId: user?.id || null,
          });
          await supabase.from('procurement_orders').update({
            status: 'pending_update_send',
            current_version: nextVer,
            last_edited_after_send_at: now,
          } as any).eq('id', orderId);
          await logActivity('post_send_edit', order.status, 'pending_update_send', { version: nextVer });
          toast.success(`נשמרה גרסה חדשה (v${nextVer}). ניתן לשלוח עדכון לספקים.`);
        } else {
          toast.success('השינויים נשמרו');
        }
      } else {
        toast.success('השינויים נשמרו');
      }

      await load(); onChanged?.(); setVersionsRefresh(x => x + 1);
    } catch (e: any) {
      console.error(e);
      toast.error('שגיאה בשמירה');
    } finally { setLoading(false); }
  };

  const deleteLine = async (lineId: string, lineName: string) => {
    if (!confirm(`למחוק את "${lineName}"?`)) return;
    await supabase.from('procurement_order_lines').delete().eq('id', lineId);
    await supabase.from('procurement_order_activity').insert({
      order_id: orderId, actor_id: user?.id || null, action: 'line_removed',
      details: { name: lineName } as any,
    });
    toast.success('השורה נמחקה');
    await load();
  };


  const setStatus = async (newStatus: string, extra: any = {}) => {
    setLoading(true);
    const from = order.status;
    const patch: any = { status: newStatus, admin_notes: adminNotes || null, ...extra };
    if (newStatus === 'approved') { patch.approved_at = new Date().toISOString(); patch.approved_by = user?.id; }
    if (newStatus === 'sent_to_supplier') patch.sent_to_supplier_at = new Date().toISOString();
    if (newStatus === 'delivered') patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from('procurement_orders').update(patch).eq('id', orderId);
    if (error) { toast.error('שגיאה'); setLoading(false); return; }
    await logActivity(`status_change:${newStatus}`, from, newStatus, extra);
    toast.success('עודכן');
    await load(); onChanged?.(); setLoading(false);
  };

  type BuiltPdf = {
    supplierId: string; // 'unassigned' when no supplier
    supplier: { id: string; name: string; email?: string | null; contacts?: any[] } | null;
    supplierName: string;
    doc: any;
    blob: Blob;
    fileName: string;
    lines: any[];
  };

  const buildSupplierDocs = async (opts: {
    variant?: 'original' | 'update' | 'cancellation';
    versionNumber?: number;
    changeSummaryText?: string | null;
    cancellationReason?: string | null;
  } = {}): Promise<BuiltPdf[]> => {
    const variant = opts.variant || 'original';
    const bannerText = variant === 'cancellation'
      ? 'הודעת ביטול הזמנה — יש להימנע מאספקת הפריטים הכלולים בהזמנה זו.'
      : variant === 'update'
      ? updateBannerText('mixed')
      : null;

    const supIds = [...new Set(lines.map(l => l.supplier_id).filter(Boolean))];
    const { data: fullSuppliers } = supIds.length
      ? await supabase.from('suppliers').select('id,name,contacts,email').in('id', supIds as any)
      : { data: [] as any[] };
    const supMap = new Map((fullSuppliers || []).map((s: any) => [s.id, s]));
    const groups = new Map<string, any[]>();
    lines.forEach(l => {
      const key = l.supplier_id || 'unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l);
    });

    const out: BuiltPdf[] = [];
    // Approver = current admin (or the recorded approver on the order if set)
    let approvedByName = '';
    const approverId = order.approved_by || user?.id || null;
    if (approverId) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('user_id', approverId).maybeSingle();
      approvedByName = prof?.full_name || '';
    }
    const approvedAtStr = new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (const [supKey, grpLines] of groups) {
      const sup = supMap.get(supKey);
      const supName = sup?.name || (supKey === 'unassigned' ? 'ללא ספק' : 'ספק');
      const doc = await generateSupplierPdf({
        supplier_name: supName,
        supplier_contacts: sup?.contacts || [],
        order_number: order.order_number,
        date: new Date().toLocaleDateString('he-IL'),
        billing_entity: order.billing_entity,
        client_name: order.clients?.name,
        site_name: order.shipping_addresses?.site_name,
        shipping_address: order.shipping_addresses?.address,
        contact_name: order.contact_name || order.shipping_addresses?.contact_name,
        contact_phone: order.contact_phone || order.shipping_addresses?.contact_phone,
        shipping_notes: order.shipping_notes,
        include_prices: canManage,
        variant,
        version_number: opts.versionNumber,
        banner_text: bannerText,
        change_summary_text: opts.changeSummaryText || null,
        cancellation_reason: opts.cancellationReason || null,
        cancelled_by_name: variant === 'cancellation' ? (order.creator?.full_name || '') : null,
        approved_by_name: variant === 'cancellation' ? null : approvedByName,
        approved_at: variant === 'cancellation' ? null : approvedAtStr,
        lines: grpLines.map((l) => {
          const sci = allSci.find(s => s.id === l.supplier_catalog_item_id);
          return {
            supplier_sku: sci?.supplier_sku,
            product_name: l.internal_catalog_items?.name || '',
            unit: sci?.purchase_unit || l.internal_catalog_items?.unit_of_measure || '',
            quantity: l.quantity,
            note: l.admin_note || l.user_note,
            unit_price: l.unit_price_snapshot,
            total: l.line_total_snapshot,
          };
        }),
      });
      const suffix = variant === 'cancellation' ? '_ביטול' : variant === 'update' ? `_v${opts.versionNumber || 2}` : '';
      const fileName = `${order.order_number}${suffix}_${supName}.pdf`;
      const blob = doc.output('blob') as Blob;
      out.push({ supplierId: supKey, supplier: sup || null, supplierName: supName, doc, blob, fileName, lines: grpLines });
    }
    return out;
  };

  // Local-download only (kept for the "הפק PDF" button).
  const generatePdfs = async (opts: {
    variant?: 'original' | 'update' | 'cancellation';
    versionNumber?: number;
    changeSummaryText?: string | null;
    cancellationReason?: string | null;
  } = {}) => {
    if (!order) return;
    const docs = await buildSupplierDocs(opts);
    docs.forEach(d => d.doc.save(d.fileName));
    await logActivity('pdfs_generated', order.status, order.status, {
      suppliers: docs.map(d => d.supplierId), variant: opts.variant || 'original',
    });
  };

  const approveAndPdf = async () => {
    if (isDirty) await saveChanges();
    await setStatus('approved');
    await ensureOriginalVersion();
    await generatePdfs({ variant: 'original', versionNumber: 1 });
  };

  const ensureOriginalVersion = async () => {
    const latest = await loadLatestVersion(orderId);
    if (latest) return;
    const { o, ls } = await fetchFresh();
    const snap = buildSnapshotFromLines(o, ls, allSci as any, 1);
    await createVersion({
      orderId, versionNumber: 1, documentType: 'original',
      snapshot: snap, changeSummary: null, userId: user?.id || null,
    });
    setVersionsRefresh(x => x + 1);
  };

  /** Sends the order via the server-side n8n function. Failed attempts only write activity/log rows. */
  const sendViaN8n = async (
    eventType: N8nSendPayload['eventType'],
    opts: {
      versionNumber?: number;
      changeSummaryText?: string | null;
      cancellationReason?: string | null;
      finalStatus?: string; // status to set on all-success
      versionId?: string | null; // update this version row on success
      allowResend?: boolean;
    } = {},
  ): Promise<{ ok: number; failed: number }> => {
    if (!order) return { ok: 0, failed: 0 };
    const variant = eventType === 'order_cancelled' ? 'cancellation'
      : eventType === 'order_updated' ? 'update' : 'original';

    // Duplicate-send guard: if the version we're about to send is already 'sent'.
    if (opts.versionId && !opts.allowResend) {
      const { data: v } = await supabase
        .from('procurement_order_versions' as any)
        .select('send_status')
        .eq('id', opts.versionId)
        .maybeSingle();
      if (v && (v as any).send_status === 'sent') {
        toast.error('הזמנה זו כבר נשלחה לספק');
        return { ok: 0, failed: 0 };
      }
    }

    // Pre-flight: at least one supplier assigned.
    const supIds = [...new Set(lines.map(l => l.supplier_id).filter(Boolean))];
    if (!supIds.length) { toast.error('לא נבחר ספק להזמנה'); return { ok: 0, failed: 0 }; }

    toast.loading('מפיק PDF...', { id: 'n8n-send' });
    await logActivity('n8n_pdf_generation_started', order.status, order.status, { eventType, version: opts.versionNumber || null });

    let docs: BuiltPdf[];
    try {
      docs = await buildSupplierDocs({
        variant,
        versionNumber: opts.versionNumber,
        changeSummaryText: opts.changeSummaryText,
        cancellationReason: opts.cancellationReason,
      });
      if (!docs.length) throw new Error('אין שורות להזמנה');
    } catch (e: any) {
      const err = e?.message || String(e);
      toast.dismiss('n8n-send');
      toast.error(`לא ניתן היה להפיק את קובץ ההזמנה. ההזמנה לא נשלחה לספק. (${err})`);
      await logActivity('n8n_send_failed', order.status, order.status, {
        stage: 'pdf_generation_failed', error: err, eventType,
      });
      return { ok: 0, failed: 1 };
    }
    await logActivity('n8n_pdf_generated', order.status, order.status, {
      eventType, files: docs.map(d => d.fileName),
    });

    toast.loading('שומר את המסמך...', { id: 'n8n-send' });
    const pdfs = [];
    for (const d of docs) {
      if (!d.supplier || d.supplierId === 'unassigned') {
        toast.dismiss('n8n-send');
        toast.error('לא ניתן לשלוח: חסר ספק להזמנה.');
        await logActivity('n8n_send_failed', order.status, order.status, { stage: 'supplier_not_found', supplier: d.supplierName, eventType });
        return { ok: 0, failed: 1 };
      }
      try {
        const uploaded = await uploadPdfForN8n({
          orderId,
          orderNumber: order.order_number,
          version: opts.versionNumber || order.current_version || 1,
          fileName: d.fileName,
          blob: d.blob,
        });
        pdfs.push({ supplierId: d.supplierId, fileName: d.fileName, storagePath: uploaded.path });
        await logActivity('n8n_pdf_uploaded', order.status, order.status, {
          eventType, supplier: d.supplierName, path: uploaded.path, size: uploaded.size, file: d.fileName,
        });
      } catch (e: any) {
        const err = e?.message || String(e);
        toast.dismiss('n8n-send');
        const stage = err.startsWith('pdf_empty') ? 'pdf_empty'
          : err.startsWith('pdf_verify_failed') ? 'pdf_verify_failed'
          : 'pdf_upload_failed';
        await logActivity('n8n_send_failed', order.status, order.status, {
          stage, supplier: d.supplierName, error: err, eventType, file: d.fileName,
        });
        toast.error(`ה־PDF הופק אך שמירתו נכשלה. ההזמנה לא נשלחה. (${err})`);
        return { ok: 0, failed: 1 };
      }
    }

    toast.loading('מכין קישור מאובטח ושולח לספק...', { id: 'n8n-send' });
    const res = await sendOrderToN8n({
      orderId,
      eventType,
      orderVersion: opts.versionNumber || order.current_version || 1,
      pdfs,
      versionId: opts.versionId || null,
      allowResend: opts.allowResend,
      finalStatus: opts.finalStatus || null,
    });

    toast.dismiss('n8n-send');
    if (res.success) {
      toast.success('ההזמנה נשלחה בהצלחה לספק והועברה לארכיון.');
      setVersionsRefresh(x => x + 1);
      await load(); onChanged?.();
      return { ok: 1, failed: 0 };
    }

    const stage = res.failure_stage || (res.error_name === 'n8n_timeout' ? 'n8n_timeout' : 'n8n_request_not_started');
    const message = res.error_message || res.message || stage;
    if (!res.edge_function_invoked) {
      await logActivity('n8n_send_failed', order.status, order.status, { stage: 'n8n_request_not_started', error: message, eventType });
    }
    if (stage === 'supplier_email_missing') {
      toast.error('הספק אינו מכיל כתובות מייל פעילות. יש לעדכן אנשי קשר לפני שליחה.');
    } else if (stage === 'signed_url_generation_failed' || stage === 'signed_url_verification_failed') {
      toast.error(`ה־PDF נשמר, אך לא ניתן היה ליצור/לאמת קישור מאובטח לשליחה. (${message})`);
    } else if (stage === 'n8n_timeout') {
      toast.error('הבקשה ל־n8n חרגה מזמן ההמתנה.');
    } else if (stage === 'pdf_not_found') {
      toast.error(`הקובץ לא נמצא בעת השליחה לספק. (${message})`);
    } else {
      toast.error(`שליחת ההזמנה נכשלה: ${message}`);
    }
    setVersionsRefresh(x => x + 1);
    await load();
    return { ok: 0, failed: 1 };
  };


  const currentTotalBeforeVat = () =>
    lines.reduce((s, l) => {
      const dr = draft[l.id]; const sci = allSci.find(x => x.id === dr?.supplier_catalog_item_id);
      if (!sci || !dr) return s;
      return s + effTotal(sci, dr.quantity).total;
    }, 0);

  const enforceMinimum = () => {
    const total = currentTotalBeforeVat();
    if (total < MIN_ORDER_TOTAL) {
      toast.error(`סכום המינימום לביצוע הזמנה הוא ${MIN_ORDER_TOTAL} ₪. לא ניתן לשלוח את ההזמנה בסכום הנוכחי (${total.toFixed(2)} ₪).`);
      return false;
    }
    return true;
  };

  const approveAndSend = async () => {
    if (!enforceMinimum()) return;
    if (isDirty) await saveChanges();
    await setStatus('approved');
    await ensureOriginalVersion();
    const latest = await loadLatestVersion(orderId);
    await sendViaN8n('order_created', {
      versionNumber: latest?.version_number || 1,
      versionId: latest?.id || null,
      finalStatus: 'sent_to_supplier',
    });
  };

  const sendUpdateToSuppliers = async () => {
    if (!enforceMinimum()) return;
    const latest = await loadLatestVersion(orderId);
    if (!latest) { toast.error('אין גרסה לשליחה'); return; }
    const summaryText = latest.change_summary ? summarizeDiffHebrew(latest.change_summary as any) : null;
    await sendViaN8n('order_updated', {
      versionNumber: latest.version_number,
      versionId: latest.id,
      changeSummaryText: summaryText,
      finalStatus: 'update_sent',
    });
  };

  const resendCurrent = async () => {
    if (!isSuperAdmin) return;
    const latest = await loadLatestVersion(orderId);
    if (!latest) { toast.error('אין גרסה לשליחה'); return; }
    if (!confirm('לשלוח שוב לספק? השליחה תופיע כפעולה חדשה בהיסטוריה.')) return;
    const eventType: N8nSendPayload['eventType'] =
      latest.document_type === 'cancellation' ? 'order_cancelled'
      : latest.document_type === 'update' ? 'order_updated'
      : 'order_created';
    await sendViaN8n(eventType, {
      versionNumber: latest.version_number,
      versionId: latest.id,
      allowResend: true,
      finalStatus: eventType === 'order_cancelled' ? undefined
        : eventType === 'order_updated' ? 'update_sent' : 'sent_to_supplier',
    });
  };



  const canDelete = isSuperAdmin && ['draft', 'pending_approval'].includes(order?.status);
  const canCancel = isSuperAdmin && !['draft', 'pending_approval', 'cancelled', 'rejected'].includes(order?.status);

  const doDelete = async () => {
    await logActivity('deleted', order.status, null, { order_number: order.order_number });
    await supabase.from('procurement_order_lines').delete().eq('order_id', orderId);
    await supabase.from('procurement_orders').delete().eq('id', orderId);
    toast.success('ההזמנה נמחקה');
    setConfirmDelete(false);
    onOpenChange(false);
    onChanged?.();
  };

  const doCancel = async () => {
    if (!cancelReason.trim()) { toast.error('חובה למלא סיבת ביטול'); return; }
    const wasSent = ['sent_to_supplier', 'update_sent', 'edited_after_send', 'pending_update_send'].includes(order.status);
    const now = new Date().toISOString();
    await supabase.from('procurement_orders').update({
      status: 'cancelled',
      cancellation_reason: cancelReason,
      cancelled_at: now,
      cancelled_by: user?.id || null,
    } as any).eq('id', orderId);
    await logActivity('cancelled', order.status, 'cancelled', { reason: cancelReason });

    if (wasSent) {
      // Create cancellation version + send to suppliers via n8n
      const { o, ls } = await fetchFresh();
      const ver = await nextVersionNumber();
      const snap = buildSnapshotFromLines(o, ls, allSci as any, ver);
      const v = await createVersion({
        orderId, versionNumber: ver, documentType: 'cancellation',
        snapshot: snap, changeSummary: null, userId: user?.id || null,
      });
      await sendViaN8n('order_cancelled', {
        versionNumber: ver,
        versionId: (v as any)?.id || null,
        cancellationReason: cancelReason,
      });
    } else {
      toast.success('ההזמנה בוטלה');
    }
    setCancelOpen(false); setCancelReason('');
    setVersionsRefresh(x => x + 1);
    await load(); onChanged?.();
  };


  if (!order) return null;

  const totalBefore = lines.reduce((s, l) => {
    const dr = draft[l.id]; const sci = allSci.find(x => x.id === dr?.supplier_catalog_item_id);
    if (!sci || !dr) return s;
    return s + effTotal(sci, dr.quantity).total;
  }, 0);

  const canEditStatus = ['pending_approval', 'in_review', 'returned_for_fix'].includes(order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            הזמנה {order.order_number}
            <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            {order.current_version && order.current_version > 1 && (
              <Badge variant="outline">v{order.current_version}</Badge>
            )}
            <div className="mr-auto flex gap-2">
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 ml-1" /> מחק הזמנה
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
                  <XCircle className="h-4 w-4 ml-1" /> בטל הזמנה
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">מזמין: </span>
          <b>{order.billing_entity || 'ירוק שירותי אחזקה ניקיון וכח אדם בע"מ 514854116'}</b>
        </div>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">מבקש</div><div>{order.creator?.full_name || '-'}</div></CardContent></Card>
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">אתר / לקוח</div><div>{order.shipping_addresses?.site_name || '-'} {order.clients?.name ? `— ${order.clients.name}` : ''}</div></CardContent></Card>
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">כתובת שילוח</div><div>{order.shipping_addresses?.address || '-'}</div></CardContent></Card>
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">איש קשר</div><div>{order.contact_name || '-'} {order.contact_phone || ''}</div></CardContent></Card>
        </div>
        {order.shipping_notes && <div className="text-sm"><b>הערות שילוח:</b> {order.shipping_notes}</div>}
        {order.rejection_reason && <div className="text-sm text-destructive"><b>סיבת דחייה:</b> {order.rejection_reason}</div>}

        {canManage && basket && (
          <Card className="border-primary/40">
            <CardContent className="py-3 space-y-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <Scale className="h-4 w-4 text-primary" /> השוואת עלות לפי ספק
                <span className="text-xs text-muted-foreground font-normal">
                  ({basket.totalLines} פריטים בהזמנה • עלות נוכחית: ₪{basket.currentTotal.toFixed(2)} לפני מע"מ)
                </span>
              </div>
              {basket.perSupplier.length === 0 ? (
                <div className="text-muted-foreground">לא נמצאו מוצרי ספק מקושרים לפריטי ההזמנה.</div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {basket.perSupplier.map(s => {
                    const cheaper = s.diff < 0;
                    return (
                      <div key={s.supplier_id} className={`rounded-lg border p-3 space-y-1 ${s.canFulfillAll ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{s.supplier_name}</div>
                          {s.canFulfillAll
                            ? <Badge variant="default" className="text-[10px]">כיסוי מלא</Badge>
                            : <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400">חלקי</Badge>}
                        </div>
                        <div className="text-xs">עלות לפני מע"מ: <b>₪{s.total.toFixed(2)}</b></div>
                        <div className="text-xs">עלות כולל מע"מ: <b>₪{s.totalWithVat.toFixed(2)}</b></div>
                        <div className="text-xs text-muted-foreground">
                          נמצאו {s.foundCount} מתוך {basket.totalLines} מוצרים
                          {s.missingCount > 0 && ` • חסרים: ${s.missingCount}`}
                        </div>
                        {s.overagePacks > 0 && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            מארזים עם עודף: {s.overagePacks} (סה"כ עודף {s.overageUnits} יח')
                          </div>
                        )}
                        {basket.currentTotal > 0 && Math.abs(s.diff) > 0.01 && (
                          <div className={`text-xs ${cheaper ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                            פער מול הנבחר: {cheaper ? 'זול ב-' : 'יקר ב-'}₪{Math.abs(s.diff).toFixed(2)}
                            {!s.canFulfillAll && cheaper && ' — אך לא ניתן לבצע את כל ההזמנה אצלו'}
                          </div>
                        )}
                        {s.missingCount > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300">חסרים: {s.missing.slice(0, 3).join(', ')}{s.missing.length > 3 ? '…' : ''}</div>
                        )}
                        {s.canFulfillAll ? (
                          <Button size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => applySupplier(s.supplier_id)}>
                            בחר ספק זה להזמנה
                          </Button>
                        ) : (
                          <div className="text-[10px] text-muted-foreground italic text-center pt-1">לא ניתן לבחור — כיסוי חלקי</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                בוחרים ספק אחד להזמנה כולה. תוכל לתקן ידנית שורות חריגות בטבלה למטה לפני האישור.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Excel-like table */}
        {canManage ? (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-right">מוצר פנימי</th>
                  <th className="p-2 text-right w-20">כמות</th>
                  <th className="p-2 text-right min-w-[240px]">מוצר ספק</th>
                  <th className="p-2 text-right">ספק</th>
                  <th className="p-2 text-right">מק"ט</th>
                  <th className="p-2 text-right">יח' במארז</th>
                  <th className="p-2 text-right">כמות בפועל</th>
                  <th className="p-2 text-right">מחיר יח'</th>
                  <th className="p-2 text-right">סה"כ ל.מע"מ</th>
                  <th className="p-2 text-right">סה"כ כ.מע"מ</th>
                  <th className="p-2 text-right">איכות</th>
                  <th className="p-2 text-right min-w-[160px]">הערות</th>
                  <th className="p-2 text-right w-24">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const dr = draft[line.id] || { quantity: line.quantity, supplier_catalog_item_id: line.supplier_catalog_item_id, admin_note: line.admin_note || '' };
                  const { linked, similar } = lineOptions(line);
                  const activeLinked = linked.filter(s => s.active !== false);
                  const sci = allSci.find(s => s.id === dr.supplier_catalog_item_id);
                  const eff = sci ? effTotal(sci, dr.quantity) : null;

                  const alerts: { type: 'warn' | 'info'; text: string }[] = [];
                  const uniqueSuppliers = new Set(activeLinked.map(a => a.supplier_id));
                  if (activeLinked.length === 0 && similar.length === 0)
                    alerts.push({ type: 'warn', text: 'אין התאמה — בחר ידנית מכל מוצרי הספקים' });
                  else if (activeLinked.length === 0 && similar.length > 0)
                    alerts.push({ type: 'info', text: `נמצאו ${similar.length} מוצרים אפשריים נוספים שטרם שויכו` });
                  else if (uniqueSuppliers.size === 1)
                    alerts.push({ type: 'info', text: `קיים רק אצל ספק אחד (${suppliersMap.get([...uniqueSuppliers][0]) || ''})` });
                  else
                    alerts.push({ type: 'info', text: `${uniqueSuppliers.size} ספקים זמינים` });

                  return (
                    <tr key={line.id} className="border-t align-top">
                      <td className="p-2">
                        <div className="font-medium">{line.internal_catalog_items?.name}</div>
                        <div className="text-[10px] text-muted-foreground">מבוקש: {line.quantity} {line.internal_catalog_items?.unit_of_measure} • {line.user_note || ''}</div>
                        {alerts.map((a, i) => (
                          <div key={i} className={`text-[10px] mt-1 rounded px-1 py-0.5 border inline-block ${a.type === 'warn' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-900 dark:text-amber-200' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 text-blue-900 dark:text-blue-200'}`}>
                            {a.text}
                          </div>
                        ))}
                      </td>
                      <td className="p-2">
                        <Input type="number" className="w-16 h-8" value={dr.quantity}
                          onChange={e => setDraft(d => ({ ...d, [line.id]: { ...dr, quantity: parseFloat(e.target.value) || 0 } }))} />
                      </td>
                      <td className="p-2">
                        <SupplierCombobox
                          allSci={allSci}
                          linked={activeLinked}
                          similar={similar}
                          value={dr.supplier_catalog_item_id}
                          onChange={(id) => setDraft(d => ({ ...d, [line.id]: { ...dr, supplier_catalog_item_id: id } }))}
                          quantity={dr.quantity}
                        />
                      </td>
                      <td className="p-2">{sci?.suppliers?.name || '—'}</td>
                      <td className="p-2 font-mono">{sci?.supplier_sku || '—'}</td>
                      <td className="p-2">{sci?.pack_size || '—'}</td>
                      <td className="p-2">{eff?.actual ?? '—'}{eff && eff.overage > 0 && <span className="text-amber-600"> (+{eff.overage})</span>}</td>
                      <td className="p-2">{sci ? `₪${Number(sci.unit_price).toFixed(2)}` : '—'}</td>
                      <td className="p-2 font-medium">{eff ? `₪${eff.total.toFixed(2)}` : '—'}</td>
                      <td className="p-2 font-medium">{eff ? `₪${(eff.total * (1 + VAT)).toFixed(2)}` : '—'}</td>
                      <td className="p-2">{sci ? qualityLabel[sci.quality] : '—'}</td>
                      <td className="p-2">
                        <Input className="h-8" value={dr.admin_note}
                          onChange={e => setDraft(d => ({ ...d, [line.id]: { ...dr, admin_note: e.target.value } }))} />
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setCompareLineId(line.id)}>
                            <Eye className="h-3 w-3 ml-1" /> השוואת ספקים
                          </Button>
                          {isSuperAdmin && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => deleteLine(line.id, line.internal_catalog_items?.name || '')}>
                              <Trash2 className="h-3 w-3 ml-1" /> מחק
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/50">
                <tr>
                  <td colSpan={8} className="p-2 text-left font-semibold">סה"כ הזמנה</td>
                  <td className="p-2 font-bold">₪{totalBefore.toFixed(2)}</td>
                  <td className="p-2 font-bold">₪{(totalBefore * (1 + VAT)).toFixed(2)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="p-2 text-right">מוצר</th><th className="p-2 text-right">כמות</th><th className="p-2 text-right">הערה</th></tr></thead>
              <tbody>{lines.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.internal_catalog_items?.name}</td>
                  <td className="p-2">{l.quantity} {l.internal_catalog_items?.unit_of_measure}</td>
                  <td className="p-2 text-muted-foreground">{l.user_note || '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {canManage && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => setAddLineOpen(true)}>
                <Plus className="h-4 w-4 ml-1" /> הוסף מוצר להזמנה
              </Button>
              {POST_SEND_STATUSES.includes(order.status) && (
                <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> ההזמנה כבר נשלחה — כל שינוי ייצור גרסה חדשה שיש לשלוח לספקים.
                </div>
              )}
            </div>
            <Textarea placeholder="הערות אדמין" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} />
            {canEditStatus && <Input placeholder="סיבת דחייה / הערה להחזרה" value={reason} onChange={e => setReason(e.target.value)} />}
            <div className="flex flex-wrap gap-2">
              {currentTotalBeforeVat() < MIN_ORDER_TOTAL && !['cancelled', 'rejected'].includes(order.status) && (
                <div className="w-full text-xs px-3 py-2 rounded border border-destructive/40 bg-destructive/5 text-destructive">
                  סכום המינימום לביצוע הזמנה הוא {MIN_ORDER_TOTAL} ₪. לא ניתן לשלוח את ההזמנה בסכום הנוכחי.
                </div>
              )}
              <Button onClick={saveChanges} disabled={loading || !isDirty}><Save className="h-4 w-4 ml-1" /> שמור</Button>
              {canEditStatus && (
                <>
                  <Button variant="destructive" onClick={() => setStatus('rejected', { rejection_reason: reason })} disabled={loading}><XCircle className="h-4 w-4 ml-1" /> דחה</Button>
                  <Button onClick={approveAndSend} disabled={loading}><Send className="h-4 w-4 ml-1" /> אשר ושלח לספק</Button>
                </>
              )}
              {order.status === 'approved' && (
                <>
                  <Button onClick={() => generatePdfs({ variant: 'original', versionNumber: 1 })}><FileDown className="h-4 w-4 ml-1" /> הפק PDF</Button>
                  <Button onClick={approveAndSend} disabled={loading}><Send className="h-4 w-4 ml-1" /> שלח לספקים</Button>
                </>
              )}
              {['sent_to_supplier', 'update_sent'].includes(order.status) && isSuperAdmin && (
                <Button variant="outline" onClick={resendCurrent} disabled={loading}>
                  <Send className="h-4 w-4 ml-1" /> שליחה חוזרת
                </Button>
              )}
              {['pending_update_send', 'edited_after_send', 'send_failed'].includes(order.status) && (
                <Button onClick={sendUpdateToSuppliers} disabled={loading}>
                  <Send className="h-4 w-4 ml-1" /> שלח עדכון לספקים (הזמנה מעודכנת)
                </Button>
              )}
              {(order.status === 'sent_to_supplier' || order.status === 'update_sent') && (
                <Button onClick={() => setStatus('delivered')}><Package className="h-4 w-4 ml-1" /> סמן כסופק</Button>
              )}
            </div>
          </div>
        )}

        {canManage && versionsExist && <OrderVersionsPanel orderId={orderId} refreshKey={versionsRefresh} />}


        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">היסטוריית פעולות</h3>
          <div className="space-y-1 text-xs">
            {activity.map(a => (
              <div key={a.id} className="flex gap-2 border-b py-1">
                <span className="text-muted-foreground w-40">{new Date(a.created_at).toLocaleString('he-IL')}</span>
                <span className="font-medium">{a.profiles?.full_name || 'משתמש'}</span>
                <span>{a.action}</span>
                {a.to_status && <Badge variant="outline">{STATUS_LABEL[a.to_status] || a.to_status}</Badge>}
              </div>
            ))}
            {activity.length === 0 && <div className="text-muted-foreground">אין רישומים</div>}
          </div>
        </div>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>מחיקת הזמנה</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>מספר הזמנה: <b>{order.order_number}</b></div>
              <div>מבקש: <b>{order.creator?.full_name || '-'}</b></div>
              <div className="text-muted-foreground">הפעולה תמחק את ההזמנה לצמיתות.</div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>ביטול</Button>
              <Button variant="destructive" onClick={doDelete}>אישור מחיקה</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>ביטול הזמנה</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>מספר הזמנה: <b>{order.order_number}</b></div>
              {['sent_to_supplier','update_sent','edited_after_send','pending_update_send'].includes(order.status) && (
                <div className="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-300 rounded p-2 text-amber-900 dark:text-amber-200">
                  ההזמנה כבר נשלחה — תופק הודעת ביטול רשמית ותישלח לספקים.
                </div>
              )}
              <Textarea
                placeholder="סיבת ביטול (חובה)"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason(''); }}>סגור</Button>
              <Button variant="destructive" onClick={doCancel} disabled={loading || !cancelReason.trim()}>בטל הזמנה</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={n8nResultOpen} onOpenChange={setN8nResultOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader><DialogTitle>תוצאת בדיקת חיבור n8n</DialogTitle></DialogHeader>
            {n8nResult && (
              <div className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">סטטוס</div>
                    <Badge variant={n8nResult.success ? 'default' : 'destructive'}>{n8nResult.success ? 'הצליח' : 'נכשל'}</Badge>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">HTTP Status</div>
                    <div className="font-mono">{n8nResult.http_status ?? '-'}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Edge Function</div>
                    <div>{n8nResult.edge_function_invoked ? 'הופעלה' : 'לא הופעלה'}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">משך</div>
                    <div>{n8nResult.duration_ms != null ? `${n8nResult.duration_ms}ms` : '-'}</div>
                  </div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-muted-foreground">שגיאה</div>
                  <div className="font-mono text-xs break-words">{n8nResult.error_name || '-'}</div>
                  <div className="text-xs break-words">{n8nResult.error_message || '-'}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-muted-foreground">Response</div>
                  <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs font-mono">
                    {n8nResult.response_body || n8nResult.message || '-'}
                  </pre>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setN8nResultOpen(false)}>סגור</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AddOrderLineDialog
          orderId={orderId}
          open={addLineOpen}
          onOpenChange={setAddLineOpen}
          onAdded={() => { load(); onChanged?.(); }}
          currentUserId={user?.id || null}
          currentSortOrder={lines.length}
        />


        {/* Per-line supplier comparison */}
        <Dialog open={!!compareLineId} onOpenChange={(v) => !v && setCompareLineId(null)}>
          <DialogContent dir="rtl" className="max-w-4xl">
            {(() => {
              const line = lines.find(l => l.id === compareLineId); if (!line) return null;
              const dr = draft[line.id] || { quantity: line.quantity, supplier_catalog_item_id: line.supplier_catalog_item_id, admin_note: '' };
              const { linked, similar } = lineOptions(line);
              const opts = [...linked, ...similar].filter(s => s.active !== false);
              return (
                <>
                  <DialogHeader><DialogTitle>השוואת ספקים — {line.internal_catalog_items?.name}</DialogTitle></DialogHeader>
                  <div className="text-xs text-muted-foreground mb-2">כמות מבוקשת: {dr.quantity} {line.internal_catalog_items?.unit_of_measure}</div>
                  {opts.length === 0 ? (
                    <div className="text-muted-foreground p-4 text-center">אין מוצרי ספק מקושרים לפריט זה.</div>
                  ) : (
                    <div className="border rounded overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted"><tr>
                          <th className="p-2 text-right">ספק</th>
                          <th className="p-2 text-right">מק"ט</th>
                          <th className="p-2 text-right">שם מוצר</th>
                          <th className="p-2 text-right">מחיר יח'</th>
                          <th className="p-2 text-right">יח' במארז</th>
                          <th className="p-2 text-right">כמות בפועל</th>
                          <th className="p-2 text-right">עלות כוללת</th>
                          <th className="p-2 text-right">איכות</th>
                          <th className="p-2 text-right">הערות</th>
                          <th className="p-2"></th>
                        </tr></thead>
                        <tbody>
                          {opts.sort((a, b) => effTotal(a, dr.quantity).total - effTotal(b, dr.quantity).total).map(s => {
                            const e = effTotal(s, dr.quantity);
                            const isSelected = s.id === dr.supplier_catalog_item_id;
                            return (
                              <tr key={s.id} className={`border-t ${isSelected ? 'bg-primary/5' : ''}`}>
                                <td className="p-2">{s.suppliers?.name || '-'}</td>
                                <td className="p-2 font-mono">{s.supplier_sku || '-'}</td>
                                <td className="p-2">{s.supplier_product_name}</td>
                                <td className="p-2">₪{Number(s.unit_price).toFixed(2)}</td>
                                <td className="p-2">{s.pack_size}</td>
                                <td className="p-2">{e.actual}{e.overage > 0 && <span className="text-amber-600"> (+{e.overage})</span>}</td>
                                <td className="p-2 font-medium">₪{e.total.toFixed(2)}</td>
                                <td className="p-2">{qualityLabel[s.quality]}</td>
                                <td className="p-2 text-muted-foreground">{s.notes || '-'}</td>
                                <td className="p-2">
                                  <Button size="sm" variant={isSelected ? 'secondary' : 'default'} className="h-7 text-[10px]"
                                    onClick={() => { setDraft(d => ({ ...d, [line.id]: { ...dr, supplier_catalog_item_id: s.id } })); setCompareLineId(null); }}>
                                    {isSelected ? 'נבחר' : 'בחר'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
};

// ------------ Supplier Combobox ------------
const SupplierCombobox = ({ allSci, linked, similar, value, onChange, quantity }: {
  allSci: SCI[]; linked: SCI[]; similar: SCI[]; value: string | null;
  onChange: (id: string) => void; quantity: number;
}) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const selected = allSci.find(s => s.id === value);
  const label = selected ? `${selected.suppliers?.name || ''} — ${selected.supplier_product_name || selected.supplier_sku || ''}` : 'בחר מוצר ספק';

  const source = showAll ? allSci : [...linked, ...similar];
  const dedup = Array.from(new Map(source.map(s => [s.id, s])).values());

  const priced = (s: SCI) => {
    const pack = Math.max(1, s.pack_size || 1);
    const tot = Math.ceil((quantity || 1) / pack) * pack * Number(s.unit_price || 0);
    return `₪${tot.toFixed(2)}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="חיפוש מוצר ספק / מק״ט / ספק..." />
          <div className="flex items-center justify-between px-2 py-1 text-xs border-b">
            <span className="text-muted-foreground">
              {showAll ? `כל המוצרים (${allSci.length})` : `מקושרים ${linked.length} • דומים ${similar.length}`}
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAll(v => !v)}>
              {showAll ? 'הצג רק מקושרים/דומים' : 'הצג את כל מוצרי הספקים'}
            </Button>
          </div>
          <CommandList className="max-h-72">
            <CommandEmpty>אין תוצאות</CommandEmpty>
            {!showAll && linked.length > 0 && (
              <CommandGroup heading="מקושרים">
                {linked.map(s => (
                  <CommandItem key={s.id} value={`${s.suppliers?.name} ${s.supplier_product_name} ${s.supplier_sku}`}
                    onSelect={() => { onChange(s.id); setOpen(false); }}>
                    <div className="flex-1">
                      <div className="text-xs font-medium">{s.suppliers?.name} — {s.supplier_product_name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.supplier_sku} • ₪{Number(s.unit_price).toFixed(2)} • מארז {s.pack_size} • {qualityLabel[s.quality]}</div>
                    </div>
                    <div className="text-xs font-semibold">{priced(s)}</div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!showAll && similar.length > 0 && (
              <CommandGroup heading="דומים (טרם שויכו)">
                {similar.map(s => (
                  <CommandItem key={s.id} value={`sim ${s.suppliers?.name} ${s.supplier_product_name} ${s.supplier_sku}`}
                    onSelect={() => { onChange(s.id); setOpen(false); }}>
                    <div className="flex-1">
                      <div className="text-xs font-medium">{s.suppliers?.name} — {s.supplier_product_name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.supplier_sku} • ₪{Number(s.unit_price).toFixed(2)} • מארז {s.pack_size}</div>
                    </div>
                    <div className="text-xs">{priced(s)}</div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showAll && (
              <CommandGroup heading={`כל המוצרים (${dedup.length})`}>
                {dedup.slice(0, 300).map(s => (
                  <CommandItem key={s.id} value={`all ${s.suppliers?.name} ${s.supplier_product_name} ${s.supplier_sku}`}
                    onSelect={() => { onChange(s.id); setOpen(false); }}>
                    <div className="flex-1">
                      <div className="text-xs font-medium">{s.suppliers?.name} — {s.supplier_product_name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.supplier_sku} • ₪{Number(s.unit_price).toFixed(2)} • מארז {s.pack_size}</div>
                    </div>
                    <div className="text-xs">{priced(s)}</div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
