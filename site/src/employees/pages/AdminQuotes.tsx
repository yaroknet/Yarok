import { useState, useEffect } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { supabase } from "@/employees/integrations/supabase/client";
import { Button } from "@/employees/components/ui/button";
import { Card } from "@/employees/components/ui/card";
import { Badge } from "@/employees/components/ui/badge";
import { Input } from "@/employees/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/employees/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Plus, Pencil, Copy, Send, Eye, Trash2, ExternalLink, Loader2, FileText, DollarSign, Mail } from "lucide-react";
import { toast } from "sonner";
import { QuoteEditorDialog } from "@/employees/components/quotes/QuoteEditorDialog";
import { PriceListManager } from "@/employees/components/quotes/PriceListManager";
import { QUOTE_STATUS_LABELS, buildQuoteUrl, buildWhatsAppShareUrl, formatCurrency } from "@/employees/lib/quoteHelpers";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface QuoteRow {
  id: string;
  quote_number: number;
  network_name_snapshot: string;
  branch_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  total_amount: number | null;
  unique_token: string;
  view_count: number;
  first_viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
}

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    void loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("id,quote_number,network_name_snapshot,branch_name,contact_name,contact_phone,contact_email,status,total_amount,unique_token,view_count,first_viewed_at,signed_at,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("שגיאה בטעינת הצעות");
    } else {
      setQuotes((data || []) as QuoteRow[]);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setEditorOpen(true);
  }

  async function copyLink(token: string) {
    const url = buildQuoteUrl(token);
    await navigator.clipboard.writeText(url);
    toast.success("הקישור הועתק");
  }

  async function sendByEmail(id: string, recipientEmail: string | null) {
    if (!recipientEmail) {
      toast.error("חסר אימייל איש קשר בהצעה");
      return;
    }
    setSendingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote", {
        body: { quoteId: id, recipientEmail },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
      toast.success(`ההצעה נשלחה ל-${recipientEmail}`);
      void loadQuotes();
    } catch (e) {
      toast.error("שגיאה בשליחה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSendingId(null);
    }
  }

  async function deleteQuote(id: string, num: number) {
    if (!confirm(`למחוק את הצעה מספר ${num}?`)) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה: " + error.message);
    } else {
      toast.success("ההצעה נמחקה");
      void loadQuotes();
    }
  }

  const filtered = quotes.filter((q) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      String(q.quote_number).includes(s) ||
      (q.network_name_snapshot || "").toLowerCase().includes(s) ||
      (q.contact_name || "").toLowerCase().includes(s) ||
      (q.branch_name || "").toLowerCase().includes(s)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">הצעות מחיר</h1>
            <p className="text-sm text-muted-foreground">ניהול הצעות, מחירון שירותים ומעקב חתימות</p>
          </div>
        </div>

        <Tabs defaultValue="quotes" className="w-full">
          <TabsList>
            <TabsTrigger value="quotes" className="gap-2">
              <FileText className="h-4 w-4" />
              הצעות מחיר
            </TabsTrigger>
            <TabsTrigger value="price-list" className="gap-2">
              <DollarSign className="h-4 w-4" />
              מחירון שירותים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 ml-1" />
                הצעה חדשה
              </Button>
            </div>

            <Card className="p-4">
              <Input
                placeholder="חיפוש לפי מספר, רשת, איש קשר..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </Card>

            <Card>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">אין הצעות מחיר עדיין.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">מס'</TableHead>
                      <TableHead className="text-right">רשת / סניף</TableHead>
                      <TableHead className="text-right">איש קשר</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">סכום</TableHead>
                      <TableHead className="text-right">פתיחות</TableHead>
                      <TableHead className="text-right">נוצר</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q, idx) => {
                      const st = QUOTE_STATUS_LABELS[q.status] || QUOTE_STATUS_LABELS.draft;
                      const url = buildQuoteUrl(q.unique_token);
                      return (
                        <TableRow key={q.id} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-mono">#{q.quote_number}</TableCell>
                          <TableCell>
                            <div className="font-medium">{q.network_name_snapshot}</div>
                            {q.branch_name && <div className="text-xs text-muted-foreground">{q.branch_name}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{q.contact_name || "—"}</div>
                            {q.contact_phone && <div className="text-xs text-muted-foreground" dir="ltr">{q.contact_phone}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge className={st.color}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(q.total_amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Eye className="h-3 w-3" />
                              {q.view_count}
                            </div>
                            {q.first_viewed_at && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(q.first_viewed_at), "dd/MM HH:mm", { locale: he })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(q.created_at), "dd/MM/yyyy", { locale: he })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button size="icon" variant="ghost" title="ערוך" onClick={() => openEdit(q.id)} disabled={q.status === "signed"}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="העתק קישור" onClick={() => copyLink(q.unique_token)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="פתח קישור" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button size="icon" variant="ghost" title="שתף בוואטסאפ" asChild>
                                <a href={buildWhatsAppShareUrl(q.contact_phone, url, q.quote_number)} target="_blank" rel="noopener noreferrer">
                                  <Send className="h-4 w-4 text-green-600" />
                                </a>
                              </Button>
                              {q.status !== "signed" && q.contact_email && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendByEmail(q.id, q.contact_email)}
                                  disabled={sendingId === q.id}
                                  title={`שלח את ההצעה במייל ל-${q.contact_email}`}
                                >
                                  {sendingId === q.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin ml-1" />
                                  ) : (
                                    <Mail className="h-4 w-4 ml-1" />
                                  )}
                                  שלח במייל
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" title="מחק" onClick={() => deleteQuote(q.id, q.quote_number)} disabled={q.status === "signed"}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="price-list" className="mt-4">
            <PriceListManager />
          </TabsContent>
        </Tabs>

        <QuoteEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          quoteId={editingId}
          onSaved={loadQuotes}
        />
      </div>
    </AdminLayout>
  );
}
