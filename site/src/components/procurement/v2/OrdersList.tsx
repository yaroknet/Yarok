import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { OrderDetailsDialog } from './OrderDetailsDialog';

// Unified pre-send label: everything that hasn't been sent to the supplier is "ממתינה לאישור".
export const STATUS_LABEL: Record<string, string> = {
  draft: 'ממתינה לאישור',
  pending_approval: 'ממתינה לאישור',
  in_review: 'ממתינה לאישור',
  returned_for_fix: 'ממתינה לאישור',
  approved: 'ממתינה לאישור',
  edited_after_send: 'ממתינה לאישור',
  pending_update_send: 'ממתינה לאישור',
  send_failed: 'ממתינה לאישור',
  rejected: 'נדחתה',
  sent_to_supplier: 'נשלחה לספק',
  update_sent: 'נשלחה לספק (עודכנה)',
  delivered: 'סופקה',
  cancelled: 'בוטלה',
  cancellation_pending_send: 'ממתינה לשליחת ביטול',
};
export const STATUS_VARIANT: Record<string, any> = {
  draft: 'secondary', pending_approval: 'secondary', in_review: 'secondary',
  returned_for_fix: 'secondary', rejected: 'destructive', approved: 'secondary',
  sent_to_supplier: 'default', delivered: 'default', cancelled: 'destructive',
  edited_after_send: 'secondary', pending_update_send: 'secondary',
  update_sent: 'default', cancellation_pending_send: 'destructive', send_failed: 'secondary',
};

interface Props { onlyMine?: boolean; statusFilter?: string[]; adminMode?: boolean; }

export const OrdersList = ({ onlyMine = false, statusFilter, adminMode = false }: Props) => {
  const { user, isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [reload, setReload] = useState(0);

  const refresh = () => setReload(x => x + 1);

  useEffect(() => {
    (async () => {
      let q = supabase.from('procurement_orders').select('*, clients(name), shipping_addresses(site_name)').order('created_at', { ascending: false });
      if (onlyMine && user) q = q.eq('created_by', user.id);
      if (statusFilter && statusFilter.length) q = q.in('status', statusFilter as any);
      const { data } = await q;
      const list = data || [];
      const uids = [...new Set(list.flatMap((o: any) => [o.requested_by, o.created_by]).filter(Boolean))];
      let names = new Map<string, string>();
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uids as any);
        (profs || []).forEach((p: any) => names.set(p.user_id, p.full_name));
      }
      setOrders(list.map((o: any) => ({ ...o, creator: { full_name: names.get(o.requested_by) || names.get(o.created_by) || '' } })));
    })();
  }, [onlyMine, user, statusFilter, reload]);

  const doDelete = async () => {
    if (!confirm || !user) return;
    const canHardDelete = ['draft', 'pending_approval'].includes(confirm.status);
    if (canHardDelete) {
      await supabase.from('procurement_order_activity').insert({
        order_id: confirm.id, actor_id: user.id, action: 'deleted',
        from_status: confirm.status as any, to_status: null,
        details: { order_number: confirm.order_number } as any,
      });
      await supabase.from('procurement_order_lines').delete().eq('order_id', confirm.id);
      await supabase.from('procurement_orders').delete().eq('id', confirm.id);
      toast.success('ההזמנה נמחקה');
    } else {
      await supabase.from('procurement_orders').update({ status: 'cancelled' }).eq('id', confirm.id);
      await supabase.from('procurement_order_activity').insert({
        order_id: confirm.id, actor_id: user.id, action: 'cancelled',
        from_status: confirm.status as any, to_status: 'cancelled' as any,
        details: { order_number: confirm.order_number } as any,
      });
      toast.success('ההזמנה בוטלה והועברה לארכיון');
    }
    setConfirm(null);
    refresh();
  };

  return (
    <>
      <div className="space-y-2">
        {orders.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">אין הזמנות</CardContent></Card>}
        {orders.map(o => {
          const canHard = isSuperAdmin && ['draft', 'pending_approval'].includes(o.status);
          const canCancel = isSuperAdmin && ['approved', 'sent_to_supplier'].includes(o.status);
          return (
            <Card key={o.id}>
              <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.creator?.full_name ? `${o.creator.full_name} • ` : ''}
                    {o.clients?.name || 'ללא לקוח'} • {o.shipping_addresses?.site_name || '-'} • {new Date(o.created_at).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(o.id)}><Eye className="h-4 w-4 ml-1" /> פתח</Button>
                  {(canHard || canCancel) && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirm(o)}>
                      {canHard ? <Trash2 className="h-4 w-4 ml-1" /> : <XCircle className="h-4 w-4 ml-1" />}
                      {canHard ? 'מחק' : 'בטל'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {selectedId && (
        <OrderDetailsDialog
          orderId={selectedId}
          open={!!selectedId}
          adminMode={adminMode}
          onOpenChange={(v) => !v && setSelectedId(null)}
          onChanged={refresh}
        />
      )}
      {confirm && (
        <Dialog open={!!confirm} onOpenChange={v => !v && setConfirm(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{['draft', 'pending_approval'].includes(confirm.status) ? 'מחיקת הזמנה' : 'ביטול הזמנה'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <div>מספר הזמנה: <b>{confirm.order_number}</b></div>
              <div>מבקש: <b>{confirm.creator?.full_name || '-'}</b></div>
              <div>לקוח / אתר: <b>{confirm.clients?.name || ''} {confirm.shipping_addresses?.site_name ? `— ${confirm.shipping_addresses.site_name}` : ''}</b></div>
              <div className="text-muted-foreground pt-2">
                {['draft', 'pending_approval'].includes(confirm.status)
                  ? 'ההזמנה תימחק לצמיתות.'
                  : 'ההזמנה תסומן כמבוטלת ותועבר לארכיון (אינה נמחקת).'}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirm(null)}>ביטול</Button>
              <Button variant="destructive" onClick={doDelete}>אישור</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
