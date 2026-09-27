import { useState, useEffect } from "react";
import { supabase } from "@/employees/integrations/supabase/client";
import { Button } from "@/employees/components/ui/button";
import { Card } from "@/employees/components/ui/card";
import { Input } from "@/employees/components/ui/input";
import { Textarea } from "@/employees/components/ui/textarea";
import { Switch } from "@/employees/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface PriceRow {
  id: string;
  network_name: string;
  service_type: string;
  base_price: number;
  travel_price: number | null;
  travel_label: string | null;
  comments: string | null;
  sort_order: number;
  is_active: boolean;
  _dirty?: boolean;
  _isNew?: boolean;
}

export function PriceListManager() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_list" as never)
      .select("*")
      .order("network_name")
      .order("sort_order");
    if (error) {
      toast.error("שגיאה בטעינת מחירון");
    } else {
      setRows((data || []) as unknown as PriceRow[]);
    }
    setLoading(false);
  }

  function update(id: string, field: keyof PriceRow, value: string | number | boolean | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value, _dirty: true } : r)));
  }

  function addRow() {
    const newRow: PriceRow = {
      id: `new-${Date.now()}-${Math.random()}`,
      network_name: "",
      service_type: "",
      base_price: 0,
      travel_price: null,
      travel_label: null,
      comments: "",
      sort_order: rows.length * 10,
      is_active: true,
      _dirty: true,
      _isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
  }

  async function removeRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (row._isNew) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    if (!confirm(`למחוק את "${row.network_name} – ${row.service_type}"?`)) return;
    const { error } = await supabase.from("price_list" as never).delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      toast.success("נמחק");
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function saveAll() {
    const dirty = rows.filter((r) => r._dirty);
    if (dirty.length === 0) {
      toast.info("אין שינויים לשמירה");
      return;
    }
    setSaving(true);
    let ok = 0;
    for (const r of dirty) {
      if (!r.network_name.trim() || !r.service_type.trim()) {
        toast.error("שם רשת וסוג שירות הם שדות חובה");
        continue;
      }
      const payload = {
        network_name: r.network_name.trim(),
        service_type: r.service_type.trim(),
        base_price: Number(r.base_price) || 0,
        travel_price: r.travel_price !== null && r.travel_price !== undefined ? Number(r.travel_price) : null,
        travel_label: r.travel_label?.trim() || null,
        comments: r.comments?.trim() || null,
        sort_order: r.sort_order,
        is_active: r.is_active,
      };
      if (r._isNew) {
        const { error } = await (supabase.from("price_list" as never) as unknown as { insert: (p: typeof payload) => Promise<{ error: { message: string } | null }> }).insert(payload);
        if (!error) ok++;
      } else {
        const { error } = await (supabase.from("price_list" as never) as unknown as { update: (p: typeof payload) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } }).update(payload).eq("id", r.id);
        if (!error) ok++;
      }
    }
    setSaving(false);
    toast.success(`נשמרו ${ok} שורות`);
    void load();
  }

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return r.network_name.toLowerCase().includes(s) || r.service_type.toLowerCase().includes(s);
  });

  const dirtyCount = rows.filter((r) => r._dirty).length;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          ניהול מחירי בסיס לפי רשת. בעורך הצעת מחיר ניתן להוסיף שירות בלחיצה אחת מהמחירון, או להזין מלל חופשי.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 ml-1" />
            שורה חדשה
          </Button>
          <Button onClick={saveAll} disabled={saving || dirtyCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            שמור שינויים {dirtyCount > 0 && `(${dirtyCount})`}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Input
          placeholder="חיפוש לפי רשת או שירות..."
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
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-32">רשת</TableHead>
                  <TableHead className="text-right w-48">סוג שירות</TableHead>
                  <TableHead className="text-right w-28">מחיר ₪</TableHead>
                  <TableHead className="text-right w-28">נסיעות ₪</TableHead>
                  <TableHead className="text-right w-32">תווית נסיעות</TableHead>
                  <TableHead className="text-right">הערות אוטומטיות</TableHead>
                  <TableHead className="text-right w-20">פעיל</TableHead>
                  <TableHead className="text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={r.id} className={r._dirty ? "bg-amber-50 dark:bg-amber-950/20" : idx % 2 === 0 ? "bg-muted/20" : ""}>
                    <TableCell>
                      <Input value={r.network_name} onChange={(e) => update(r.id, "network_name", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={r.service_type} onChange={(e) => update(r.id, "service_type", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={r.base_price} onChange={(e) => update(r.id, "base_price", Number(e.target.value))} className="h-8" dir="ltr" />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.travel_price ?? ""}
                        onChange={(e) => update(r.id, "travel_price", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8"
                        dir="ltr"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.travel_label || ""}
                        onChange={(e) => update(r.id, "travel_label", e.target.value)}
                        className="h-8"
                        placeholder="למשל: לפי מחירון פוקס"
                      />
                    </TableCell>
                    <TableCell className="min-w-[300px]">
                      <Textarea
                        value={r.comments || ""}
                        onChange={(e) => update(r.id, "comments", e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, "is_active", v)} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      אין שורות. לחץ "שורה חדשה" כדי להוסיף.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
