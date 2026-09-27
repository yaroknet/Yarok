import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown, Eye } from 'lucide-react';
import { summarizeDiffHebrew } from '@/lib/procurement/diff';

interface Props { orderId: string; refreshKey?: number; }

const DOC_LABEL: Record<string, string> = {
  original: 'הזמנה מקורית',
  update: 'הזמנה מעודכנת',
  cancellation: 'הודעת ביטול',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין לשליחה',
  sent: 'נשלח',
  failed: 'שליחה נכשלה',
};

export const OrderVersionsPanel = ({ orderId, refreshKey }: Props) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('procurement_order_versions' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      setVersions((data as any[]) || []);
    })();
  }, [orderId, refreshKey]);

  if (!versions.length) return null;

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-2">גרסאות ומסמכים</h3>
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-right">גרסה</th>
              <th className="p-2 text-right">סוג</th>
              <th className="p-2 text-right">נוצר</th>
              <th className="p-2 text-right">נשלח</th>
              <th className="p-2 text-right">סטטוס</th>
              <th className="p-2 text-right">נשלח אל</th>
              <th className="p-2 text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.id} className="border-t">
                <td className="p-2 font-bold">v{v.version_number}</td>
                <td className="p-2">{DOC_LABEL[v.document_type] || v.document_type}</td>
                <td className="p-2">{new Date(v.created_at).toLocaleString('he-IL')}</td>
                <td className="p-2">{v.sent_at ? new Date(v.sent_at).toLocaleString('he-IL') : '—'}</td>
                <td className="p-2"><Badge variant={v.send_status === 'sent' ? 'default' : v.send_status === 'failed' ? 'destructive' : 'secondary'}>{STATUS_LABEL[v.send_status]}</Badge></td>
                <td className="p-2 text-[10px] font-mono">{(v.sent_to as string[] | null)?.join(', ') || '—'}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setDetail(v)}>
                      <Eye className="h-3 w-3 ml-1" /> פרטים
                    </Button>
                    {v.pdf_url && (
                      <a href={v.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"><FileDown className="h-3 w-3 ml-1" /> PDF</Button>
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>גרסה {detail?.version_number} — {DOC_LABEL[detail?.document_type]}</DialogTitle></DialogHeader>
          {detail?.change_summary && (
            <div className="border rounded p-3 bg-muted/40 text-xs whitespace-pre-wrap">
              {summarizeDiffHebrew(detail.change_summary as any)}
            </div>
          )}
          {detail?.send_error && (
            <div className="border border-destructive/50 bg-destructive/10 rounded p-3 text-xs text-destructive">
              שגיאת שליחה: {detail.send_error}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
