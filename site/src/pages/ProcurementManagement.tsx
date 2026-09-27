import { useState } from 'react';
import { ShoppingCart, PlusCircle, ClipboardList, Package, MapPin, BarChart3, Clock, Archive, Link2, Copy, Tag } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { NewOrderWizard } from '@/components/procurement/v2/NewOrderWizard';
import { OrdersList } from '@/components/procurement/v2/OrdersList';
import { InternalCatalogManager } from '@/components/procurement/v2/InternalCatalogManager';

import { ShippingAddressesManager } from '@/components/procurement/v2/ShippingAddressesManager';
import { ManagementHoursManager } from '@/components/procurement/v2/ManagementHoursManager';
import { ProcurementDashboard } from '@/components/procurement/v2/ProcurementDashboard';

const PUBLIC_APP_ORIGIN = 'https://yaroknet.co.il';

const buildPublicUrl = (path: string) => {
  let origin = window.location.origin;
  try {
    if (window.top && window.top.location && window.top.location.origin) {
      origin = window.top.location.origin;
    }
  } catch { /* cross-origin iframe */ }
  if (/lovableproject\.com|lovable\.app|localhost|127\.0\.0\.1/i.test(origin)) {
    origin = PUBLIC_APP_ORIGIN;
  }
  return `${origin}${path}`;
};

const buildPublicOrderUrl = () => buildPublicUrl('/purchase-order-form');
const buildPublicPricesUrl = () => buildPublicUrl('/public-prices');


const copyToClipboard = async (url: string, successMsg: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      toast.success(successMsg);
      return;
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) toast.success(successMsg);
    else toast.error('העתקה נכשלה — העתק ידנית: ' + url);
  } catch {
    toast.error('העתקה נכשלה — העתק ידנית: ' + url);
  }
};

const copyPublicOrderLink = () => copyToClipboard(buildPublicOrderUrl(), 'קישור ההזמנות הציבורי הועתק ללוח');
const copyPublicPricesLink = () => copyToClipboard(buildPublicPricesUrl(), 'קישור המחירון הציבורי הועתק ללוח');

const ProcurementManagement = () => {
  const { isManager, isSuperAdmin } = useAuth();
  const canManage = isManager || isSuperAdmin;
  // Dashboard is always the default landing tab (per module spec).
  const [tab, setTab] = useState(canManage ? 'dashboard' : 'new');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="container mx-auto px-4 py-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-7 w-7" /> ניהול הזמנות חומרים</h1>
        <p className="text-muted-foreground">דשבורד, פתיחת הזמנות, מעקב, ארכיון וקטלוג</p>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">קישור הזמנות רכש (כללי)</div>
                  <div className="text-xs text-muted-foreground">
                    קישור אחד לכל החברה. בטופס בוחרים את מנהל האזור המבקש מתוך רשימת המורשים.
                  </div>
                  <div dir="ltr" className="text-xs font-mono text-muted-foreground mt-1 break-all">
                    {buildPublicOrderUrl()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.open(buildPublicOrderUrl(), '_blank', 'noopener,noreferrer')}>
                  <Link2 className="h-4 w-4 ml-2" /> פתח
                </Button>
                <Button onClick={copyPublicOrderLink}>
                  <Copy className="h-4 w-4 ml-2" /> העתק קישור
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <Tag className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">קישור מחירון ציבורי</div>
                  <div className="text-xs text-muted-foreground">
                    צפייה חופשית במחירוני הספקים ללא צורך בהתחברות.
                  </div>
                  <div dir="ltr" className="text-xs font-mono text-muted-foreground mt-1 break-all">
                    {buildPublicPricesUrl()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.open(buildPublicPricesUrl(), '_blank', 'noopener,noreferrer')}>
                  <Link2 className="h-4 w-4 ml-2" /> פתח
                </Button>
                <Button onClick={copyPublicPricesLink}>
                  <Copy className="h-4 w-4 ml-2" /> העתק קישור
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {canManage && <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 ml-1" /> דשבורד</TabsTrigger>}
          <TabsTrigger value="new"><PlusCircle className="h-4 w-4 ml-1" /> הזמנה חדשה</TabsTrigger>
          {canManage && <TabsTrigger value="pending"><Clock className="h-4 w-4 ml-1" /> הזמנות בתהליך</TabsTrigger>}
          {!canManage && <TabsTrigger value="mine"><ClipboardList className="h-4 w-4 ml-1" /> ההזמנות שלי</TabsTrigger>}
          {canManage && <TabsTrigger value="archive"><Archive className="h-4 w-4 ml-1" /> ארכיון</TabsTrigger>}
          {canManage && <TabsTrigger value="catalog"><Package className="h-4 w-4 ml-1" /> קטלוג מוצרים</TabsTrigger>}
          {canManage && <TabsTrigger value="addresses"><MapPin className="h-4 w-4 ml-1" /> כתובות שילוח</TabsTrigger>}
          {canManage && <TabsTrigger value="hours"><Clock className="h-4 w-4 ml-1" /> שעות ניהול</TabsTrigger>}
        </TabsList>

        {canManage && <TabsContent value="dashboard" className="mt-6"><ProcurementDashboard /></TabsContent>}
        <TabsContent value="new" className="mt-6"><NewOrderWizard onCreated={() => { setRefreshKey(k => k + 1); setTab(canManage ? 'pending' : 'mine'); }} /></TabsContent>
        {!canManage && <TabsContent value="mine" className="mt-6"><OrdersList key={`mine-${refreshKey}`} onlyMine adminMode={false} /></TabsContent>}
        {canManage && <TabsContent value="pending" className="mt-6"><OrdersList key={`pend-${refreshKey}`} statusFilter={['draft','pending_approval','in_review','returned_for_fix','approved','edited_after_send','pending_update_send','send_failed']} adminMode /></TabsContent>}
        {canManage && <TabsContent value="archive" className="mt-6"><OrdersList key={`arc-${refreshKey}`} statusFilter={['sent_to_supplier','update_sent','delivered','cancelled','rejected']} adminMode /></TabsContent>}
        {canManage && <TabsContent value="catalog" className="mt-6"><InternalCatalogManager /></TabsContent>}
        {canManage && <TabsContent value="addresses" className="mt-6"><ShippingAddressesManager /></TabsContent>}
        {canManage && <TabsContent value="hours" className="mt-6"><ManagementHoursManager /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default ProcurementManagement;

