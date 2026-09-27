import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Trash2, Send, ShoppingCart, ClipboardList, Check, ChevronsUpDown, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Manager { user_id: string; full_name: string; }
interface Client { id: string; name: string; address?: string | null; contact_name?: string | null; phone?: string | null; }
interface Address { id: string; client_id: string; site_name: string; address: string; contact_name?: string | null; contact_phone?: string | null; notes?: string | null; }
interface CatalogItem { id: string; name: string; unit_of_measure: string; category?: string | null; }
interface OrderLine { key: string; internal_item_id: string; quantity: number; user_note: string; }

interface DestOption {
  key: string;
  label: string;
  client: Client;
  address?: Address;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "טיוטה", variant: "outline" },
  pending_approval: { label: "ממתין לאישור", variant: "secondary" },
  in_review: { label: "בבדיקה", variant: "secondary" },
  returned_for_fix: { label: "נדרש תיקון", variant: "destructive" },
  rejected: { label: "נדחה", variant: "destructive" },
  approved: { label: "אושר", variant: "default" },
  sent_to_supplier: { label: "נשלח לספק", variant: "default" },
  delivered: { label: "סופק", variant: "default" },
  cancelled: { label: "בוטל", variant: "outline" },
};

export default function PurchaseOrderForm() {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [managers, setManagers] = useState<Manager[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [managerId, setManagerId] = useState<string>("");
  const [managerOpen, setManagerOpen] = useState(false);

  const [destKey, setDestKey] = useState<string>("");
  const [destOpen, setDestOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [customClientName, setCustomClientName] = useState("");
  const [customShippingAddress, setCustomShippingAddress] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("procurement-form", {
      body: { action, ...extra },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  useEffect(() => {
    (async () => {
      try {
        const data: any = await call("info");
        setManagers(data.managers || []);
        setClients(data.clients || []);
        setAddresses(data.addresses || []);
        setCatalog(data.catalog_items || []);
      } catch {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedManager = useMemo(
    () => managers.find((m) => m.user_id === managerId),
    [managers, managerId],
  );

  const destinations = useMemo<DestOption[]>(() => {
    const opts: DestOption[] = [];
    const usedAddressIds = new Set<string>();
    for (const c of clients) {
      const sites = addresses.filter((a) => a.client_id === c.id);
      if (sites.length === 0) {
        opts.push({ key: `c:${c.id}`, label: c.name, client: c });
      } else {
        for (const s of sites) {
          usedAddressIds.add(s.id);
          opts.push({
            key: `s:${s.id}`,
            label: `${c.name} — ${s.site_name}${s.address ? ` (${s.address})` : ""}`,
            client: c,
            address: s,
          });
        }
      }
    }
    // Include standalone shipping addresses (no linked client) so all sites are selectable.
    for (const s of addresses) {
      if (usedAddressIds.has(s.id)) continue;
      opts.push({
        key: `s:${s.id}`,
        label: `${s.site_name}${s.address ? ` (${s.address})` : ""}`,
        client: { id: s.client_id || "", name: s.site_name },
        address: s,
      });
    }
    // "Other" — free-text entry
    opts.push({ key: "other", label: "אחר (הזנה ידנית)", client: { id: "", name: "" } });
    return opts;
  }, [clients, addresses]);


  const selectedDest = useMemo(() => destinations.find((d) => d.key === destKey), [destinations, destKey]);

  const isOther = destKey === "other";

  const chooseDest = (key: string) => {
    setDestKey(key);
    setDestOpen(false);
    if (key === "other") {
      setContactName("");
      setContactPhone("");
      setShippingNotes("");
      return;
    }
    setCustomClientName("");
    setCustomShippingAddress("");
    const d = destinations.find((x) => x.key === key);
    if (!d) return;
    setContactName(d.address?.contact_name || d.client.contact_name || "");
    setContactPhone(d.address?.contact_phone || d.client.phone || "");
    setShippingNotes(d.address?.notes || "");
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), internal_item_id: "", quantity: 1, user_note: "" },
    ]);
  };

  const updateLine = (key: string, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const submit = async () => {
    if (!managerId) { toast.error("יש לבחור מנהל אזור מבקש"); return; }
    if (!selectedDest) { toast.error("יש לבחור לקוח / כתובת שילוח"); return; }
    if (isOther && !customClientName.trim()) { toast.error("יש להזין שם לקוח"); return; }
    if (isOther && !customShippingAddress.trim()) { toast.error("יש להזין כתובת שילוח"); return; }
    const validLines = lines.filter((l) => l.internal_item_id && l.quantity > 0);
    if (validLines.length === 0) { toast.error("יש להוסיף לפחות מוצר אחד"); return; }
    const otherMissing = validLines.some((l) => {
      if (l.internal_item_id !== "00000000-0000-0000-0000-000000000001") return false;
      const note = l.user_note || "";
      const name = note.startsWith("מוצר מותאם: ") ? note.slice("מוצר מותאם: ".length).split("\n")[0].trim() : "";
      return !name;
    });
    if (otherMissing) { toast.error('יש להזין שם מוצר עבור שורות "אחר"'); return; }
    setSubmitting(true);
    try {
      const composedNotes = isOther
        ? [
            `לקוח (הזנה ידנית): ${customClientName.trim()}`,
            `כתובת שילוח: ${customShippingAddress.trim()}`,
            shippingNotes.trim() ? `הערות: ${shippingNotes.trim()}` : "",
          ].filter(Boolean).join("\n")
        : shippingNotes;
      const res: any = await call("create", {
        requested_by_user_id: managerId,
        client_id: isOther ? null : selectedDest.client.id,
        shipping_address_id: isOther ? null : (selectedDest.address?.id || null),
        contact_name: contactName,
        contact_phone: contactPhone,
        shipping_notes: composedNotes,
        lines: validLines.map((l) => ({
          internal_item_id: l.internal_item_id,
          quantity: l.quantity,
          user_note: l.user_note,
        })),
      });
      toast.success(`ההזמנה התקבלה • מספר ${res.order_number || res.order_id.slice(0, 8)}`);
      setLines([]);
      setShippingNotes("");
      setDestKey("");
      setCustomClientName("");
      setCustomShippingAddress("");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בשליחת ההזמנה");
    } finally {
      setSubmitting(false);
    }
  };

  const loadMyOrders = async () => {
    if (!managerId) { setOrders([]); return; }
    setOrdersLoading(true);
    try {
      const data: any = await call("my_orders", { requested_by_user_id: managerId });
      setOrders(data.orders || []);
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בטעינת הזמנות");
    } finally {
      setOrdersLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-bold mb-2">שגיאה בטעינת הטופס</h1>
            <p className="text-muted-foreground">אירעה שגיאה בטעינת נתוני ההזמנה. נסה שוב מאוחר יותר.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">פתיחת הזמנת ציוד</h1>
          <p className="text-sm opacity-90">ירוק שירותי אחזקה וניקיון</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        <Tabs defaultValue="new" onValueChange={(v) => v === "mine" && loadMyOrders()}>
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="new"><ShoppingCart className="h-4 w-4 ml-1" /> הזמנה חדשה</TabsTrigger>
            <TabsTrigger value="mine"><ClipboardList className="h-4 w-4 ml-1" /> ההזמנות שלי</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> מנהל אזור מבקש <span className="text-destructive">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Popover open={managerOpen} onOpenChange={setManagerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-right">
                        {selectedManager ? selectedManager.full_name : "התחל להקליד שם מנהל..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const s = search.trim().toLowerCase();
                        if (!s) return 1;
                        return value.toLowerCase().includes(s) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="חיפוש מנהל..." />
                      <CommandList className="max-h-72">
                        <CommandEmpty>לא נמצאו מנהלים</CommandEmpty>
                        <CommandGroup>
                          {managers.map((m) => (
                            <CommandItem
                              key={m.user_id}
                              value={m.full_name}
                              onSelect={() => { setManagerId(m.user_id); setManagerOpen(false); }}
                            >
                              <Check className={cn("ml-2 h-4 w-4", managerId === m.user_id ? "opacity-100" : "opacity-0")} />
                              <span className="text-right flex-1">{m.full_name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">פרטי משלוח</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>לקוח / כתובת שילוח</Label>
                  <Popover open={destOpen} onOpenChange={setDestOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate text-right">
                          {selectedDest ? selectedDest.label : "התחל להקליד שם לקוח או אתר..."}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const s = search.trim().toLowerCase();
                          if (!s) return 1;
                          return value.toLowerCase().includes(s) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="חיפוש לקוח / אתר..." />
                        <CommandList className="max-h-72">
                          <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
                          <CommandGroup>
                            {destinations.map((d) => (
                              <CommandItem
                                key={d.key}
                                value={d.label}
                                onSelect={() => chooseDest(d.key)}
                              >
                                <Check className={cn("ml-2 h-4 w-4", destKey === d.key ? "opacity-100" : "opacity-0")} />
                                <span className="text-right flex-1">{d.label}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedDest?.address?.address && !isOther && (
                    <p className="text-xs text-muted-foreground mt-1">כתובת: {selectedDest.address.address}</p>
                  )}
                </div>

                {isOther && (
                  <div className="space-y-3 rounded-md border border-dashed p-3 bg-muted/30">
                    <div>
                      <Label>שם לקוח <span className="text-destructive">*</span></Label>
                      <Input
                        value={customClientName}
                        onChange={(e) => setCustomClientName(e.target.value)}
                        placeholder="לדוגמה: חברת דוגמה בע״מ"
                      />
                    </div>
                    <div>
                      <Label>כתובת שילוח <span className="text-destructive">*</span></Label>
                      <Input
                        value={customShippingAddress}
                        onChange={(e) => setCustomShippingAddress(e.target.value)}
                        placeholder="רחוב, מספר, עיר"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>איש קשר</Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                  </div>
                  <div>
                    <Label>טלפון</Label>
                    <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>הערות משלוח</Label>
                  <Textarea rows={2} value={shippingNotes} onChange={(e) => setShippingNotes(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">מוצרים</CardTitle>
                <Button size="sm" onClick={addLine}><Plus className="h-4 w-4 ml-1" /> הוסף מוצר</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {lines.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">לחץ "הוסף מוצר" כדי להתחיל</p>
                )}
                {lines.map((line) => (
                  <ProductLineEditor
                    key={line.key}
                    line={line}
                    catalog={catalog}
                    onUpdate={(patch) => updateLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 text-base"
              disabled={submitting || lines.length === 0 || !selectedDest || !managerId || (isOther && (!customClientName.trim() || !customShippingAddress.trim()))}
              onClick={submit}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-5 w-5 ml-2" /> שלח הזמנה לאישור</>}
            </Button>
          </TabsContent>

          <TabsContent value="mine">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">ההזמנות שלי</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {!managerId && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    בחר תחילה מנהל אזור בטאב "הזמנה חדשה" לצפייה בהזמנות
                  </p>
                )}
                {managerId && ordersLoading && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                {managerId && !ordersLoading && orders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">אין הזמנות עדיין</p>
                )}
                {orders.map((o) => {
                  const s = statusLabels[o.status] || { label: o.status, variant: "outline" as const };
                  return (
                    <div key={o.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{o.order_number || o.id.slice(0, 8)}</div>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{o.clients?.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("he-IL")}</div>
                      {o.status === "rejected" && o.rejection_reason && (
                        <div className="mt-2 text-sm text-destructive">סיבת דחייה: {o.rejection_reason}</div>
                      )}
                      {o.status === "returned_for_fix" && o.admin_notes && (
                        <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">הערות: {o.admin_notes}</div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const OTHER_ITEM_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_NOTE_PREFIX = "מוצר מותאם: ";

function ProductLineEditor({
  line,
  catalog,
  onUpdate,
  onRemove,
}: {
  line: OrderLine;
  catalog: CatalogItem[];
  onUpdate: (patch: Partial<OrderLine>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const item = catalog.find((c) => c.id === line.internal_item_id);
  const isOther = line.internal_item_id === OTHER_ITEM_ID;

  // For "other": split user_note into custom product name + optional extra note.
  const rawNote = line.user_note || "";
  const otherName = isOther && rawNote.startsWith(OTHER_NOTE_PREFIX)
    ? rawNote.slice(OTHER_NOTE_PREFIX.length).split("\n")[0]
    : "";
  const otherExtra = isOther
    ? (rawNote.startsWith(OTHER_NOTE_PREFIX)
        ? rawNote.split("\n").slice(1).join("\n")
        : rawNote)
    : "";

  const updateOtherName = (name: string) => {
    const extra = otherExtra.trim();
    onUpdate({ user_note: `${OTHER_NOTE_PREFIX}${name}${extra ? "\n" + extra : ""}` });
  };
  const updateOtherExtra = (extra: string) => {
    onUpdate({ user_note: `${OTHER_NOTE_PREFIX}${otherName}${extra ? "\n" + extra : ""}` });
  };

  // Filter out the "Other" sentinel from the catalog list and append it as a special entry.
  const regularCatalog = catalog.filter((c) => c.id !== OTHER_ITEM_ID);

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="flex-1 justify-between font-normal"
            >
              <span className="truncate text-right">
                {isOther ? "אחר (מוצר מותאם)" : item ? item.name : "התחל להקליד שם מוצר..."}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) => {
                const s = search.trim().toLowerCase();
                if (!s) return 1;
                return value.toLowerCase().includes(s) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="חיפוש מוצר..." />
              <CommandList className="max-h-72">
                <CommandEmpty>לא נמצאו מוצרים</CommandEmpty>
                <CommandGroup>
                  {regularCatalog.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.category || ""}`}
                      onSelect={() => {
                        onUpdate({ internal_item_id: c.id, user_note: "" });
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("ml-2 h-4 w-4", line.internal_item_id === c.id ? "opacity-100" : "opacity-0")} />
                      <span className="text-right flex-1">{c.name}</span>
                    </CommandItem>
                  ))}
                  <CommandItem
                    value="אחר מוצר מותאם חופשי אחרי"
                    onSelect={() => {
                      onUpdate({ internal_item_id: OTHER_ITEM_ID, user_note: OTHER_NOTE_PREFIX });
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("ml-2 h-4 w-4", isOther ? "opacity-100" : "opacity-0")} />
                    <span className="text-right flex-1 font-medium">אחר (הזנה חופשית)</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {isOther && (
        <div>
          <Label className="text-xs">שם המוצר המבוקש <span className="text-destructive">*</span></Label>
          <Input
            value={otherName}
            onChange={(e) => updateOtherName(e.target.value)}
            placeholder="פרט את שם המוצר שברצונך להזמין"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">כמות ({item?.unit_of_measure || "יחידה"})</Label>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={line.quantity}
          onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value) || 1) })}
          className="w-24"
        />
      </div>
      <Input
        placeholder={isOther ? "פרטים נוספים (מותג, גודל, קישור...)" : "הערה (אופציונלי)"}
        value={isOther ? otherExtra : line.user_note}
        onChange={(e) => (isOther ? updateOtherExtra(e.target.value) : onUpdate({ user_note: e.target.value }))}
      />
    </div>
  );
}
