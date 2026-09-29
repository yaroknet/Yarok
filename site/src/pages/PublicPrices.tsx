import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Loader2 } from "lucide-react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

// Dedicated anon client — no auth session, no session refresh, no toasts.
const SUPABASE_ANON = SUPABASE_PUBLISHABLE_KEY;
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

interface Supplier { id: string; name: string; }
interface Item {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  purchase_unit: string | null;
  pack_size: number | null;
  unit_price: number | null;
  notes: string | null;
}

const currency = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n);

export default function PublicPrices() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState<string>("all");

  useEffect(() => {
    document.title = "מחירון מוצרים - ירוק";
    (async () => {
      const { data: it } = await (anonClient as any)
        .from("public_price_list")
        .select("id,supplier_id,supplier_name,supplier_sku,supplier_product_name,purchase_unit,pack_size,unit_price,notes")
        .order("supplier_product_name");
      const rows = (it ?? []) as Item[];
      const seen = new Map<string, string>();
      rows.forEach((r) => {
        if (r.supplier_id && r.supplier_name && !seen.has(r.supplier_id)) seen.set(r.supplier_id, r.supplier_name);
      });
      setSuppliers(
        Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "he")),
      );
      setItems(rows);
      setLoading(false);
    })();
  }, []);

  const supplierMap = useMemo(() => {
    const m = new Map<string, string>();
    suppliers.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [suppliers]);


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (supplierId !== "all" && i.supplier_id !== supplierId) return false;
      if (!term) return true;
      return (
        (i.supplier_product_name ?? "").toLowerCase().includes(term) ||
        (i.supplier_sku ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, supplierId]);

  return (
    <div dir="rtl" className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary">מחירון מוצרים</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            צפייה חופשית במחירונים לפי ספק. אין צורך בהתחברות.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חפש לפי שם מוצר או מק״ט..."
              className="h-14 pr-12 text-lg"
              aria-label="חיפוש מוצר"
            />
          </div>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-14 text-lg" aria-label="בחר ספק">
              <SelectValue placeholder="בחר ספק" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-lg">כל הספקים</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-lg">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-base text-muted-foreground">
          {loading ? "טוען..." : `נמצאו ${filtered.length} מוצרים`}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-lg text-muted-foreground">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
            לא נמצאו מוצרים תואמים
          </Card>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((i) => (
                <Card key={i.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold leading-snug">
                      {i.supplier_product_name ?? "—"}
                    </h2>
                    <div className="text-xl font-bold text-primary whitespace-nowrap">
                      {currency(i.unit_price)}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary" className="text-sm">{supplierMap.get(i.supplier_id) ?? "—"}</Badge>
                    {i.supplier_sku && <Badge variant="outline" className="text-sm">מק״ט: {i.supplier_sku}</Badge>}
                    {i.purchase_unit && <Badge variant="outline" className="text-sm">{i.purchase_unit}</Badge>}
                    {i.pack_size ? <Badge variant="outline" className="text-sm">מארז: {i.pack_size}</Badge> : null}
                  </div>
                  {i.notes && <p className="mt-2 text-sm text-muted-foreground">{i.notes}</p>}
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-lg border bg-card">
              <table className="w-full text-right">
                <thead className="bg-muted/60 text-base">
                  <tr>
                    <th className="p-3 font-semibold">שם מוצר</th>
                    <th className="p-3 font-semibold">ספק</th>
                    <th className="p-3 font-semibold">מק״ט</th>
                    <th className="p-3 font-semibold">יחידה</th>
                    <th className="p-3 font-semibold">גודל מארז</th>
                    <th className="p-3 font-semibold">מחיר</th>
                    <th className="p-3 font-semibold">הערות</th>
                  </tr>
                </thead>
                <tbody className="text-base">
                  {filtered.map((i, idx) => (
                    <tr key={i.id} className={idx % 2 ? "bg-muted/20" : ""}>
                      <td className="p-3 font-medium">{i.supplier_product_name ?? "—"}</td>
                      <td className="p-3">{supplierMap.get(i.supplier_id) ?? "—"}</td>
                      <td className="p-3">{i.supplier_sku ?? "—"}</td>
                      <td className="p-3">{i.purchase_unit ?? "—"}</td>
                      <td className="p-3">{i.pack_size ?? "—"}</td>
                      <td className="p-3 font-bold text-primary whitespace-nowrap">{currency(i.unit_price)}</td>
                      <td className="p-3 text-muted-foreground">{i.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
