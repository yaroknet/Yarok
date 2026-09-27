import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const ProcurementDashboard = () => {
  const [stats, setStats] = useState<any>({ monthOrders: 0, monthCost: 0, byUser: [], byClient: [], bySupplier: [], byProduct: [], hoursByClient: [] });

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const EXCLUDED = ['cancelled', 'rejected'];
      const [{ data: ordersRaw }, { data: lines }, { data: profiles }, { data: clients }, { data: suppliers }, { data: items }, { data: hours }] = await Promise.all([
        supabase.from('procurement_orders').select('id,created_by,client_id,status,created_at').gte('created_at', monthStart),
        supabase.from('procurement_order_lines').select('order_id,internal_item_id,supplier_id,line_total_snapshot,quantity'),
        supabase.from('profiles').select('user_id,full_name'),
        supabase.from('clients').select('id,name'),
        supabase.from('suppliers').select('id,name'),
        supabase.from('internal_catalog_items').select('id,name'),
        supabase.from('management_hours').select('*'),
      ]);
      const orders = (ordersRaw || []).filter((o: any) => !EXCLUDED.includes(o.status));
      const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const cMap = new Map((clients || []).map((c: any) => [c.id, c.name]));
      const sMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));
      const iMap = new Map((items || []).map((i: any) => [i.id, i.name]));

      const { data: allOrdersData } = await supabase.from('procurement_orders').select('id,created_by,client_id,status,created_at');
      const allOrders = (allOrdersData || []).filter((o: any) => !EXCLUDED.includes(o.status));
      const orderMap = new Map(allOrders.map((o: any) => [o.id, o]));

      const monthOrderIds = new Set(orders.map((o: any) => o.id));
      const totalMonthCost = (lines || []).filter((l: any) => monthOrderIds.has(l.order_id)).reduce((s: number, l: any) => s + Number(l.line_total_snapshot || 0), 0);

      const byUser = new Map<string, number>();
      const byClient = new Map<string, number>();
      const bySupplier = new Map<string, number>();
      const byProduct = new Map<string, number>();
      (lines || []).forEach((l: any) => {
        const o = orderMap.get(l.order_id);
        if (!o) return; // skip lines from cancelled/rejected orders
        const cost = Number(l.line_total_snapshot || 0);
        byUser.set(pMap.get(o.created_by) || '—', (byUser.get(pMap.get(o.created_by) || '—') || 0) + cost);
        byClient.set(cMap.get(o.client_id) || '—', (byClient.get(cMap.get(o.client_id) || '—') || 0) + cost);
        if (l.supplier_id) bySupplier.set(sMap.get(l.supplier_id) || '—', (bySupplier.get(sMap.get(l.supplier_id) || '—') || 0) + cost);
        byProduct.set(iMap.get(l.internal_item_id) || '—', (byProduct.get(iMap.get(l.internal_item_id) || '—') || 0) + Number(l.quantity || 0));
      });

      const hoursByClient = new Map<string, number>();
      (hours || []).forEach((h: any) => {
        const key = cMap.get(h.client_id) || '—';
        hoursByClient.set(key, (hoursByClient.get(key) || 0) + Number(h.hours || 0));
      });

      const toArr = (m: Map<string, number>) => Array.from(m.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a,b) => b.value - a.value).slice(0, 10);

      setStats({
        monthOrders: (orders || []).length,
        monthCost: totalMonthCost,
        byUser: toArr(byUser), byClient: toArr(byClient), bySupplier: toArr(bySupplier), byProduct: toArr(byProduct),
        hoursByClient: Array.from(hoursByClient.entries()).map(([client, h]) => {
          const cost = byClient.get(client) || 0;
          return { name: client, hours: h, costPerHour: h > 0 ? Number((cost / h).toFixed(2)) : 0 };
        }),
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-4"><div className="text-xs text-muted-foreground">הזמנות החודש</div><div className="text-2xl font-bold">{stats.monthOrders}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-muted-foreground">עלות חומרים החודש</div><div className="text-2xl font-bold">₪{stats.monthCost.toFixed(0)}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-muted-foreground">מנהל אזור עם סך הזמנות הכי גבוה</div><div className="text-lg font-medium">{stats.byUser[0]?.name || '—'}</div><div className="text-xs">₪{stats.byUser[0]?.value || 0}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-muted-foreground">לקוח/אתר עם סך הזמנות הכי גבוה</div><div className="text-lg font-medium">{stats.byClient[0]?.name || '—'}</div><div className="text-xs">₪{stats.byClient[0]?.value || 0}</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">סך עלויות לפי מנהל אזור</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={stats.byUser}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">סך עלויות לפי לקוח / אתר</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={stats.byClient}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">עלות לפי ספק</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={stats.bySupplier}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">מוצרים הכי מוזמנים (כמות)</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer><BarChart data={stats.byProduct}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">עלות חומרים לשעת ניהול (לפי לקוח)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr><th className="p-2 text-right">לקוח</th><th className="p-2 text-right">שעות ניהול</th><th className="p-2 text-right">₪ לשעה</th></tr></thead>
            <tbody>
              {stats.hoursByClient.map((r: any) => (
                <tr key={r.name} className="border-b"><td className="p-2">{r.name}</td><td className="p-2">{r.hours}</td><td className="p-2">₪{r.costPerHour}</td></tr>
              ))}
              {stats.hoursByClient.length === 0 && <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">אין נתוני שעות ניהול</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
