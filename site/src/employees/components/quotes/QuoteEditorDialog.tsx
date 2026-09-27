import { useState, useEffect } from "react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/employees/components/ui/dialog";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Textarea } from "@/employees/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Card } from "@/employees/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MATERIAL_OPTIONS, FREQUENCY_OPTIONS, formatCurrency } from "@/employees/lib/quoteHelpers";
import { cn } from "@/employees/lib/utils";

interface QuoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  onSaved: () => void;
}

interface QuoteItem {
  id?: string;
  description: string;
  frequency: string;
  price: number;
  quantity: number;
  sort_order: number;
}

interface PriceListEntry {
  id: string;
  network_name: string;
  service_type: string;
  base_price: number;
  travel_price: number | null;
  travel_label: string | null;
  comments: string | null;
}

interface NetworkOption {
  id: string;
  name: string;
  vat_number: string | null;
  billing_address: string | null;
  office_phone: string | null;
  billing_email: string | null;
  is_new_client: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export function QuoteEditorDialog({ open, onOpenChange, quoteId, onSaved }: QuoteEditorDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [priceList, setPriceList] = useState<PriceListEntry[]>([]);

  // Form state
  const [networkId, setNetworkId] = useState<string>("");
  const [networkName, setNetworkName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("orit@yaroknet.co.il");
  const [paymentTerms, setPaymentTerms] = useState("15 יום מחשבונית");
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialsOther, setMaterialsOther] = useState("");
  const [requiresClientDetails, setRequiresClientDetails] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([
    { description: "", frequency: "חודשי", price: 0, quantity: 1, sort_order: 0 },
  ]);
  // Track which service_types were applied from price list, so we can re-apply on network change
  const [appliedServiceTypes, setAppliedServiceTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void loadNetworks();
    void loadPriceList();
    if (quoteId) {
      void loadQuote(quoteId);
    } else {
      resetForm();
    }
  }, [open, quoteId]);

  async function loadPriceList() {
    const { data, error } = await (supabase.from("price_list" as never) as unknown as { select: (q: string) => { eq: (c: string, v: boolean) => { order: (c: string) => Promise<{ data: PriceListEntry[] | null; error: { message: string } | null }> } } })
      .select("id,network_name,service_type,base_price,travel_price,travel_label,comments")
      .eq("is_active", true)
      .order("sort_order");
    if (error) {
      // Silent — price list is optional
      return;
    }
    setPriceList((data || []) as PriceListEntry[]);
  }

  async function loadNetworks() {
    const { data, error } = await supabase
      .from("networks")
      .select("id,name,vat_number,billing_address,office_phone,billing_email,is_new_client,contact_name,contact_phone,contact_email")
      .order("name");
    if (error) {
      toast.error("שגיאה בטעינת רשתות");
      return;
    }
    setNetworks((data || []) as NetworkOption[]);
  }

  async function loadQuote(id: string) {
    setLoading(true);
    const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
    if (error || !quote) {
      toast.error("שגיאה בטעינת ההצעה");
      setLoading(false);
      return;
    }
    setNetworkId(quote.network_id || "");
    setNetworkName(quote.network_name_snapshot || "");
    setBranchName(quote.branch_name || "");
    setContactName(quote.contact_name || "");
    setContactPhone(quote.contact_phone || "");
    setContactEmail(quote.contact_email || "");
    setNotificationEmail(quote.notification_email || "orit@yaroknet.co.il");
    setPaymentTerms(quote.payment_terms || "15 יום מחשבונית");
    setNotes(quote.notes || "");
    setMaterials(quote.materials || []);
    setMaterialsOther(quote.materials_other_text || "");
    setRequiresClientDetails(Boolean((quote as { requires_client_details?: boolean }).requires_client_details));

    const { data: itemData } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", id)
      .order("sort_order");
    setItems(
      (itemData || []).map((it) => ({
        id: it.id,
        description: it.description,
        frequency: it.frequency || "חודשי",
        price: Number(it.price),
        quantity: Number((it as { quantity?: number }).quantity ?? 1),
        sort_order: it.sort_order,
      })),
    );
    setLoading(false);
  }

  function resetForm() {
    setNetworkId("");
    setNetworkName("");
    setBranchName("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setNotificationEmail("orit@yaroknet.co.il");
    setPaymentTerms("15 יום מחשבונית");
    setNotes("");
    setMaterials([]);
    setMaterialsOther("");
    setRequiresClientDetails(false);
    setItems([{ description: "", frequency: "חודשי", price: 0, quantity: 1, sort_order: 0 }]);
    setAppliedServiceTypes([]);
  }

  function handleNetworkChange(id: string) {
    setNetworkId(id);
    const n = networks.find((x) => x.id === id);
    if (n) {
      setNetworkName(n.name);
      if (!contactName) setContactName(n.contact_name || "");
      if (!contactPhone) setContactPhone(n.contact_phone || "");
      if (!contactEmail) setContactEmail(n.contact_email || "");
    }
  }

  function toggleMaterial(key: string) {
    setMaterials((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", frequency: "חודשי", price: 0, quantity: 1, sort_order: prev.length }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  // Fox-group networks: same price list, NEVER sum totals
  const FOX_GROUP_NETWORKS = [
    "פוקס", "פוקס הום", "א.א", "TCP", "מנגו", "נייק", "פוט לוקר",
    "טרמינל X", "סטרונגפול", "איתי ברנדס", "רובי ביי", "ארי", "אופליין",
  ];

  function isFoxGroup(name: string): boolean {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    return FOX_GROUP_NETWORKS.some((f) => {
      const fn = f.toLowerCase();
      return n === fn || n.includes(fn) || fn.includes(n);
    });
  }

  const inFoxGroup = isFoxGroup(networkName);

  // Markers used to wrap auto-generated notes so we can refresh them on network change
  const AUTO_NOTES_START = "<!-- AUTO_PRICE_NOTES_START -->";
  const AUTO_NOTES_END = "<!-- AUTO_PRICE_NOTES_END -->";

  function stripAutoNotes(text: string): string {
    if (!text) return "";
    const re = new RegExp(`\\n*${AUTO_NOTES_START}[\\s\\S]*?${AUTO_NOTES_END}\\n*`, "g");
    return text.replace(re, "").trim();
  }

  function wrapAutoNotes(lines: string[]): string {
    if (lines.length === 0) return "";
    return `${AUTO_NOTES_START}\n${lines.join("\n")}\n${AUTO_NOTES_END}`;
  }

  // Build auto notes for a list of service_types using the current network's price list
  function buildAutoNotesFor(serviceTypes: string[], networkNm: string): string[] {
    const lines: string[] = [];
    const foxNow = isFoxGroup(networkNm);
    serviceTypes.forEach((stype) => {
      const entry = priceList.find((p) => {
        const pn = p.network_name.toLowerCase();
        const nn = networkNm.trim().toLowerCase();
        const networkMatches = pn.includes(nn) || nn.includes(pn);
        return networkMatches && p.service_type === stype;
      });
      if (!entry) return;
      const block: string[] = [`▸ ${entry.service_type}`];
      if (entry.travel_label && entry.travel_label.trim()) {
        block.push(`  נסיעות: ${entry.travel_label.trim()}`);
      } else if (foxNow && entry.travel_price && Number(entry.travel_price) > 0) {
        block.push(`  נסיעות: ${Number(entry.travel_price)} ₪ פר עובד`);
      }
      if (entry.comments && entry.comments.trim()) {
        block.push(`  ${entry.comments.trim()}`);
      }
      lines.push(...block);
    });
    return lines;
  }

  function applyPriceListEntry(idx: number, entry: PriceListEntry) {
    // Update the service row itself
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      return {
        ...it,
        description: `${entry.network_name} – ${entry.service_type}`,
        price: Number(entry.base_price),
      };
    }));

    // For non-Fox-group: add travel as its own row (price * workers count)
    if (!inFoxGroup && entry.travel_price && Number(entry.travel_price) > 0) {
      setItems((prev) => {
        const travelDesc = `נסיעות – ${entry.service_type} (פר עובד)`;
        if (prev.some((it) => it.description === travelDesc)) return prev;
        const serviceRow = prev[idx];
        const workers = Number(serviceRow?.quantity || 1);
        return [
          ...prev,
          {
            description: travelDesc,
            frequency: serviceRow?.frequency || "חודשי",
            price: Number(entry.travel_price),
            quantity: workers,
            sort_order: prev.length,
          },
        ];
      });
    }

    // Track applied service_type so we can refresh notes on network change
    setAppliedServiceTypes((prev) => (prev.includes(entry.service_type) ? prev : [...prev, entry.service_type]));

    toast.success(
      inFoxGroup
        ? "המחירון הוחל (קבוצת פוקס — ללא סיכום אוטומטי)"
        : "המחירון הוחל — נוספה שורת נסיעות לחישוב",
    );
  }

  // Refresh auto-notes block whenever network or applied service types change
  useEffect(() => {
    if (!open || loading) return;
    setNotes((prev) => {
      const manual = stripAutoNotes(prev || "");
      if (appliedServiceTypes.length === 0 || !networkName.trim()) {
        return manual;
      }
      const lines = buildAutoNotesFor(appliedServiceTypes, networkName);
      const block = wrapAutoNotes(lines);
      if (!block) return manual;
      return manual ? `${manual}\n${block}` : block;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkName, appliedServiceTypes, priceList]);

  // Filter price list by selected network (fuzzy match)
  const relevantPriceEntries = priceList.filter((p) => {
    if (!networkName.trim()) return false;
    const n = networkName.trim().toLowerCase();
    const pn = p.network_name.toLowerCase();
    return pn.includes(n) || n.includes(pn);
  });

  const totalAmount = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);

  // Detect distinct price-list networks used inside service rows (by "<network> – <service>" prefix)
  function detectMixedPriceNetworks(): string[] {
    const known = new Set(priceList.map((p) => p.network_name.trim()));
    const used = new Set<string>();
    items.forEach((it) => {
      const desc = (it.description || "").trim();
      const m = desc.match(/^([^–\-]+?)\s*[–\-]\s*/);
      if (!m) return;
      const candidate = m[1].trim();
      if (known.has(candidate)) used.add(candidate);
    });
    return Array.from(used);
  }

  const mixedNetworks = detectMixedPriceNetworks();
  const hasMixedNetworks = mixedNetworks.length > 1;

  async function handleSave() {
    if (!user) return;
    if (!networkName.trim()) {
      toast.error("יש לבחור או להזין שם רשת");
      return;
    }
    if (items.length === 0 || !items.some((it) => it.description.trim())) {
      toast.error("יש להוסיף לפחות שורת שירות אחת");
      return;
    }
    if (hasMixedNetworks) {
      toast.error(`לא ניתן לשמור הצעה המשלבת מחירונים מרשתות שונות: ${mixedNetworks.join(", ")}. אנא צרו הצעה נפרדת לכל רשת.`);
      return;
    }
    setSaving(true);

    const payload = {
      network_id: networkId || null,
      network_name_snapshot: networkName.trim(),
      branch_name: branchName.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      notification_email: notificationEmail.trim() || null,
      payment_terms: paymentTerms,
      notes: (() => {
        // Strip the AUTO markers but keep the inner content for display in PDF/preview
        const clean = (notes || "").replace(new RegExp(AUTO_NOTES_START, "g"), "").replace(new RegExp(AUTO_NOTES_END, "g"), "").trim();
        return clean || null;
      })(),
      materials,
      materials_other_text: materials.includes("other") ? materialsOther.trim() : null,
      requires_client_details: requiresClientDetails,
      total_amount: inFoxGroup ? 0 : totalAmount,
      created_by: user.id,
    } as const;

    let savedQuoteId = quoteId;
    if (quoteId) {
      const { error } = await supabase.from("quotes").update(payload).eq("id", quoteId);
      if (error) {
        toast.error("שגיאה בשמירה: " + error.message);
        setSaving(false);
        return;
      }
      await supabase.from("quote_items").delete().eq("quote_id", quoteId);
    } else {
      const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
      if (error || !data) {
        toast.error("שגיאה ביצירה: " + (error?.message || ""));
        setSaving(false);
        return;
      }
      savedQuoteId = data.id;
    }

    const itemRows = items
      .filter((it) => it.description.trim())
      .map((it, idx) => ({
        quote_id: savedQuoteId!,
        description: it.description.trim(),
        frequency: it.frequency,
        price: Number(it.price || 0),
        quantity: Number(it.quantity || 1),
        sort_order: idx,
      }));
    if (itemRows.length) {
      const { error: itErr } = await supabase.from("quote_items").insert(itemRows);
      if (itErr) {
        toast.error("שגיאה בשמירת שורות: " + itErr.message);
        setSaving(false);
        return;
      }
    }

    toast.success(quoteId ? "ההצעה עודכנה" : "הצעה חדשה נוצרה");
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{quoteId ? "עריכת הצעת מחיר" : "הצעת מחיר חדשה"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Client */}
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">פרטי לקוח</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 relative">
                  <Label>שם רשת *</Label>
                  <Input
                    value={networkName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNetworkName(v);
                      // Clear linkage if user types a name that no longer matches
                      if (networkId) {
                        const cur = networks.find((x) => x.id === networkId);
                        if (!cur || cur.name !== v) setNetworkId("");
                      }
                    }}
                    placeholder="התחל להקליד שם רשת..."
                    autoComplete="off"
                  />
                  {networkName.trim() &&
                    !networks.some((n) => n.name === networkName.trim()) &&
                    (() => {
                      const q = networkName.trim().toLowerCase();
                      const matches = networks
                        .filter((n) => n.name.toLowerCase().includes(q))
                        .slice(0, 6);
                      if (matches.length === 0) return null;
                      return (
                        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto">
                          {matches.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => handleNetworkChange(n.id)}
                              className="w-full text-right px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                            >
                              <span>{n.name}</span>
                              {n.is_new_client && <span className="text-xs text-muted-foreground">חדש</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  {networkId && (
                    <p className="text-xs text-primary mt-1">✓ מקושר לרשת קיימת</p>
                  )}
                </div>
                <div>
                  <Label>שם סניף</Label>
                  <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
                </div>
                <div>
                  <Label>איש קשר</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div>
                  <Label>טלפון איש קשר</Label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <Label>אימייל איש קשר</Label>
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} dir="ltr" type="email" />
                </div>
                <div className="md:col-span-2">
                  <Label>אימייל למעקב פתיחה (אליו תישלח התראה כשהלקוח פותח את ההצעה)</Label>
                  <Input value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} dir="ltr" type="email" placeholder="manager@example.com" />
                </div>
              </div>
            </Card>

            {/* Services */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold">שירותים</h3>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 ml-1" />
                  הוסף שורה
                </Button>
              </div>

              {/* Quick-pick from price list when network selected */}
              {relevantPriceEntries.length > 0 && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-primary">
                    מחירון לרשת "{networkName}" — לחץ על שירות להוספה אוטומטית:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {relevantPriceEntries.map((entry) => (
                      <Button
                        key={entry.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto py-1.5 text-xs"
                        onClick={() => {
                          // Find the first empty row, or add new one
                          const emptyIdx = items.findIndex((it) => !it.description.trim());
                          if (emptyIdx >= 0) {
                            applyPriceListEntry(emptyIdx, entry);
                          } else {
                            setItems((prev) => [...prev, { description: "", frequency: "חודשי", price: 0, quantity: 1, sort_order: prev.length }]);
                            setTimeout(() => applyPriceListEntry(items.length, entry), 0);
                          }
                        }}
                      >
                        <Plus className="h-3 w-3 ml-1" />
                        {entry.service_type} · {formatCurrency(entry.base_price)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {items.map((it, idx) => {
                  const lineTotal = Number(it.price || 0) * Number(it.quantity || 1);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded bg-muted/30">
                      <div className="col-span-12 md:col-span-5">
                        <Label className="text-xs">תיאור</Label>
                        <Input
                          value={it.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder="תיאור השירות"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">תדירות</Label>
                        <Select value={it.frequency} onValueChange={(v) => updateItem(idx, "frequency", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <Label className="text-xs">כמות</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <Label className="text-xs">מחיר ליחידה ₪</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.price}
                          onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-9 md:col-span-1 text-sm font-medium text-left">
                        <Label className="text-xs">סה"כ</Label>
                        <div className="h-10 flex items-center justify-end px-2">{formatCurrency(lineTotal)}</div>
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-left font-bold pt-2 border-t">
                {inFoxGroup ? (
                  <span className="text-muted-foreground">קבוצת פוקס — ללא סיכום אוטומטי</span>
                ) : (
                  <>סה"כ כללי: {formatCurrency(totalAmount)}</>
                )}
              </div>
              {hasMixedNetworks && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  ⚠ ההצעה משלבת מחירונים מ-{mixedNetworks.length} רשתות שונות: <strong>{mixedNetworks.join(", ")}</strong>.
                  <br />לא ניתן לשלוח הצעה אחת ללקוחות שונים — אנא צרו הצעה נפרדת לכל רשת.
                </div>
              )}
            </Card>

            {/* Materials */}
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">חומרים</h3>
              <p className="text-xs text-muted-foreground">סמן רק את הפריטים שייכללו בהצעה. אם לא תסומן אף אפשרות — סעיף החומרים לא יופיע במסמך הסופי.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {MATERIAL_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                    <Checkbox checked={materials.includes(opt.key)} onCheckedChange={() => toggleMaterial(opt.key)} />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              {materials.includes("other") && (
                <div>
                  <Label>פרט: אחר</Label>
                  <Input value={materialsOther} onChange={(e) => setMaterialsOther(e.target.value)} placeholder="פרט מה כלול" />
                </div>
              )}
            </Card>

            {/* Terms & notes */}
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">תנאים והערות</h3>
              <div>
                <Label>תנאי תשלום</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
              <div>
                <Label>הערות נוספות</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <label className="flex items-start gap-2 cursor-pointer p-3 rounded border border-border bg-muted/30 hover:bg-muted/50">
                <Checkbox
                  checked={requiresClientDetails}
                  onCheckedChange={(v) => setRequiresClientDetails(Boolean(v))}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <div className="font-medium">דרוש מילוי טופס פרטי לקוח</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    כשמסומן — הלקוח יידרש למלא ח.פ, כתובת חיוב, איש קשר ואימייל לפני החתימה. הטופס יישלח להנהלת החשבונות יחד עם ההצעה החתומה.
                  </div>
                </div>
              </label>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || hasMixedNetworks}>
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {quoteId ? "עדכן" : "צור הצעה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
