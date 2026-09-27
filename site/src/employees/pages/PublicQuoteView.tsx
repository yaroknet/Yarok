import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card } from "@/employees/components/ui/card";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { QuoteBrandedHeader, QuoteBrandedFooter } from "@/employees/components/quotes/QuoteBrandedHeader";
import { SignaturePad } from "@/employees/components/quotes/SignaturePad";
import { MATERIAL_OPTIONS, formatCurrency } from "@/employees/lib/quoteHelpers";

interface PublicQuote {
  id: string;
  quote_number: number;
  network_id: string | null;
  network_name_snapshot: string;
  branch_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  materials: string[];
  materials_other_text: string | null;
  payment_terms: string;
  notes: string | null;
  total_amount: number | null;
  status: string;
  signed_at: string | null;
  client_details_filled_at: string | null;
  notification_email: string | null;
  requires_client_details: boolean;
}

interface PublicQuoteItem {
  id: string;
  description: string;
  frequency: string | null;
  price: number;
  sort_order: number;
}

interface NetworkInfo {
  is_new_client: boolean;
  vat_number: string | null;
  billing_address: string | null;
}

export default function PublicQuoteView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [items, setItems] = useState<PublicQuoteItem[]>([]);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);

  // Client details form (for new clients)
  const [vat, setVat] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [filledContact, setFilledContact] = useState("");
  const [filledOfficePhone, setFilledOfficePhone] = useState("");
  const [filledEmail, setFilledEmail] = useState("");

  // Signature
  const [signerName, setSignerName] = useState("");
  const [signerId, setSignerId] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  useEffect(() => {
    if (token) void loadQuote(token);
  }, [token]);

  async function loadQuote(t: string) {
    setLoading(true);
    const { data: q, error } = await supabase
      .from("quotes")
      .select("id,quote_number,network_id,network_name_snapshot,branch_name,contact_name,contact_phone,contact_email,materials,materials_other_text,payment_terms,notes,total_amount,status,signed_at,client_details_filled_at,notification_email,requires_client_details")
      .eq("unique_token", t)
      .maybeSingle();

    if (error || !q) {
      setLoading(false);
      return;
    }
    setQuote(q as PublicQuote);
    setSignerName(q.contact_name || "");

    const { data: it } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", q.id)
      .order("sort_order");
    setItems((it || []) as PublicQuoteItem[]);

    if (q.network_id) {
      const { data: n } = await supabase
        .from("networks")
        .select("is_new_client,vat_number,billing_address")
        .eq("id", q.network_id)
        .maybeSingle();
      if (n) {
        setNetwork(n as NetworkInfo);
        setVat(n.vat_number || "");
        setBillingAddress(n.billing_address || "");
      }
    } else {
      setNetwork({ is_new_client: true, vat_number: null, billing_address: null });
    }

    // Track view
    void trackView(q.id, q.status);
    setLoading(false);
  }

  async function trackView(quoteId: string, currentStatus: string) {
    try {
      await supabase.from("quote_view_log").insert({
        quote_id: quoteId,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      await supabase.functions.invoke("quote-viewed", { body: { quoteId } }).catch(() => null);
      const { data: cur } = await supabase.from("quotes").select("view_count,first_viewed_at").eq("id", quoteId).maybeSingle();
      if (cur) {
        const updates: {
          view_count: number;
          last_viewed_at: string;
          first_viewed_at?: string;
          status?: string;
        } = {
          view_count: (cur.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        };
        if (!cur.first_viewed_at) updates.first_viewed_at = new Date().toISOString();
        if (currentStatus === "sent") updates.status = "viewed";
        await supabase.from("quotes").update(updates).eq("id", quoteId);
      }
    } catch {
      // ignore tracking errors
    }
  }

  async function handleSign() {
    if (!quote) return;
    const needsClientDetails = quote.requires_client_details === true;
    if (needsClientDetails) {
      if (!vat.trim() || !billingAddress.trim() || !filledContact.trim() || !filledEmail.trim()) {
        toast.error("יש למלא את כל פרטי הלקוח לפני החתימה");
        return;
      }
    }
    if (!signerName.trim()) {
      toast.error("יש להזין שם החותם");
      return;
    }
    if (!signatureData) {
      toast.error("יש לחתום לפני השליחה");
      return;
    }
    setSubmitting(true);

    // Upload signature to storage
    const fileName = `signatures/${quote.id}-${Date.now()}.png`;
    const blob = await (await fetch(signatureData)).blob();
    const { error: upErr } = await supabase.storage.from("quote-files").upload(fileName, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (upErr) {
      toast.error("שגיאה בהעלאת חתימה: " + upErr.message);
      setSubmitting(false);
      return;
    }
    const { data: pub } = supabase.storage.from("quote-files").getPublicUrl(fileName);

    const updates: {
      status: string;
      signed_at: string;
      signature_data: string;
      signer_name: string;
      signer_id_number: string | null;
      client_details_filled_at?: string;
      filled_vat_number?: string;
      filled_billing_address?: string;
      filled_contact_person?: string;
      filled_office_phone?: string | null;
      filled_email?: string;
    } = {
      status: "signed",
      signed_at: new Date().toISOString(),
      signature_data: pub.publicUrl,
      signer_name: signerName.trim(),
      signer_id_number: signerId.trim() || null,
    };
    if (needsClientDetails) {
      updates.client_details_filled_at = new Date().toISOString();
      updates.filled_vat_number = vat.trim();
      updates.filled_billing_address = billingAddress.trim();
      updates.filled_contact_person = filledContact.trim();
      updates.filled_office_phone = filledOfficePhone.trim() || null;
      updates.filled_email = filledEmail.trim();
    }

    const { error: updErr } = await supabase.from("quotes").update(updates).eq("id", quote.id);
    if (updErr) {
      toast.error("שגיאה בשמירה: " + updErr.message);
      setSubmitting(false);
      return;
    }

    // Trigger signed webhook (sends emails to accounting)
    await supabase.functions.invoke("quote-signed", { body: { quoteId: quote.id } }).catch(() => null);

    setSubmittedOk(true);
    setSubmitting(false);
    toast.success("ההצעה נחתמה בהצלחה!");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold mb-2">הצעה לא נמצאה</h1>
          <p className="text-muted-foreground">הקישור לא תקין או שההצעה הוסרה.</p>
        </Card>
      </div>
    );
  }

  const alreadySigned = quote.status === "signed" || submittedOk;
  const needsClientDetails = quote.requires_client_details === true;
  const visibleMaterials = MATERIAL_OPTIONS.filter((m) => quote.materials.includes(m.key));

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <Card className="p-8 bg-background">
          <QuoteBrandedHeader />

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-primary">הצעת מחיר</h1>
            <p className="text-sm text-muted-foreground mt-1">מספר הצעה: #{quote.quote_number}</p>
          </div>

          {/* Client info */}
          <Card className="p-4 mb-4 bg-muted/30">
            <h2 className="font-semibold mb-2">לכבוד</h2>
            <div className="text-sm space-y-1">
              <div><strong>{quote.network_name_snapshot}</strong>{quote.branch_name ? ` — ${quote.branch_name}` : ""}</div>
              {quote.contact_name && <div>איש קשר: {quote.contact_name}</div>}
              {quote.contact_phone && <div dir="ltr" className="text-right">טלפון: <span dir="ltr">{quote.contact_phone}</span></div>}
              {quote.contact_email && <div>אימייל: <span dir="ltr">{quote.contact_email}</span></div>}
            </div>
          </Card>

          {/* Services table */}
          <div className="mb-6">
            <h2 className="font-semibold mb-2">השירותים המוצעים</h2>
            <table className="w-full border-collapse border border-border">
              <thead className="bg-primary/10">
                <tr>
                  <th className="border border-border p-2 text-right">תיאור</th>
                  <th className="border border-border p-2 text-right w-32">תדירות</th>
                  <th className="border border-border p-2 text-right w-28">מחיר</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="border border-border p-2">{it.description}</td>
                    <td className="border border-border p-2">{it.frequency || "—"}</td>
                    <td className="border border-border p-2 font-medium">{formatCurrency(it.price)}</td>
                  </tr>
                ))}
                <tr className="bg-primary/5 font-bold">
                  <td className="border border-border p-2" colSpan={2}>סה"כ</td>
                  <td className="border border-border p-2">{formatCurrency(quote.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Materials */}
          {visibleMaterials.length > 0 && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-2">חומרים כלולים</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {visibleMaterials.map((m) => (
                  <li key={m.key}>
                    {m.key === "other" ? `אחר: ${quote.materials_other_text || ""}` : m.label}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Payment terms */}
          <Card className="p-4 mb-4">
            <h3 className="font-semibold mb-1">תנאי תשלום</h3>
            <p className="text-sm">{quote.payment_terms}</p>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-1">הערות</h3>
              <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
            </Card>
          )}

          {alreadySigned ? (
            <Card className="p-6 bg-emerald-500/10 border-emerald-500/30 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">ההצעה נחתמה בהצלחה</h2>
              <p className="text-sm text-muted-foreground mt-1">תודה! עותק חתום נשלח להנהלת החשבונות.</p>
            </Card>
          ) : (
            <>
              {needsClientDetails && (
                <Card className="p-4 mb-4 border-amber-500/40">
                  <h3 className="font-semibold mb-3 text-amber-700 dark:text-amber-300">פרטי לקוח (חובה למילוי)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>ח.פ / ע.מ *</Label>
                      <Input value={vat} onChange={(e) => setVat(e.target.value)} dir="ltr" />
                    </div>
                    <div>
                      <Label>איש קשר ראשי *</Label>
                      <Input value={filledContact} onChange={(e) => setFilledContact(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>כתובת חיוב *</Label>
                      <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
                    </div>
                    <div>
                      <Label>טלפון משרד</Label>
                      <Input value={filledOfficePhone} onChange={(e) => setFilledOfficePhone(e.target.value)} dir="ltr" />
                    </div>
                    <div>
                      <Label>אימייל *</Label>
                      <Input value={filledEmail} onChange={(e) => setFilledEmail(e.target.value)} dir="ltr" type="email" />
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-4 mb-4 border-primary/40">
                <h3 className="font-semibold mb-3">חתימה דיגיטלית</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>שם החותם *</Label>
                    <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
                  </div>
                  <div>
                    <Label>תעודת זהות (אופציונלי)</Label>
                    <Input value={signerId} onChange={(e) => setSignerId(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <SignaturePad onChange={setSignatureData} />
              </Card>

              <Button onClick={handleSign} disabled={submitting} className="w-full" size="lg">
                {submitting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                אשר וחתום על ההצעה
              </Button>
            </>
          )}

          <QuoteBrandedFooter />
        </Card>
      </div>
    </div>
  );
}
