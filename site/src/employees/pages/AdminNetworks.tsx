import { useState, useRef } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/employees/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/employees/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/employees/components/ui/collapsible";
import { Plus, Search, Trash2, Edit, ChevronDown, ChevronLeft, MapPin, Download, Upload, FileDown } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import * as XLSX from "xlsx";

const emptyNetwork = { name: "", contact_name: "", contact_phone: "", contact_email: "", report_email: "" };
const emptyBranch = { name: "", address: "", city: "" };

export default function AdminNetworks() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyNetwork);
  const [editingNetwork, setEditingNetwork] = useState<any>(null);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchForm, setBranchForm] = useState(emptyBranch);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [importingNetworks, setImportingNetworks] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: networks = [] } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("networks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Network mutations
  const addNetwork = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("networks").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["networks"] });
      setOpen(false);
      setForm(emptyNetwork);
      toast({ title: "רשת נוספה בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const updateNetwork = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("networks").update({
        name: form.name,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        report_email: form.report_email || null,
      } as any).eq("id", editingNetwork.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["networks"] });
      setEditingNetwork(null);
      setForm(emptyNetwork);
      toast({ title: "רשת עודכנה בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteNetwork = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("networks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["networks"] });
      toast({ title: "רשת נמחקה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  // Branch mutations
  const addBranch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("branches").insert({
        ...branchForm,
        network_id: activeNetworkId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      setBranchDialogOpen(false);
      setBranchForm(emptyBranch);
      toast({ title: "סניף נוסף בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const updateBranch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("branches").update({
        name: branchForm.name,
        address: branchForm.address || null,
        city: branchForm.city || null,
      }).eq("id", editingBranch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      setBranchDialogOpen(false);
      setEditingBranch(null);
      setBranchForm(emptyBranch);
      toast({ title: "סניף עודכן בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "סניף נמחק" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const filtered = networks.filter((n: any) => n.name.includes(search));

  const openEditNetwork = (n: any) => {
    setForm({ name: n.name, contact_name: n.contact_name || "", contact_phone: n.contact_phone || "", contact_email: n.contact_email || "", report_email: n.report_email || "" });
    setEditingNetwork(n);
  };

  const openAddBranch = (networkId: string) => {
    setActiveNetworkId(networkId);
    setEditingBranch(null);
    setBranchForm(emptyBranch);
    setBranchDialogOpen(true);
  };

  const openEditBranch = (b: any) => {
    setEditingBranch(b);
    setActiveNetworkId(b.network_id);
    setBranchForm({ name: b.name, address: b.address || "", city: b.city || "" });
    setBranchDialogOpen(true);
  };

  const networkFormDialog = (isEdit: boolean, dialogOpen: boolean, setDialogOpen: (v: boolean) => void) => (
    <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setForm(emptyNetwork); setEditingNetwork(null); } }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 ml-2" />
            רשת חדשה
          </Button>
        </DialogTrigger>
      )}
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת רשת" : "הוספת רשת חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); isEdit ? updateNetwork.mutate() : addNetwork.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>שם הרשת *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>איש קשר</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>טלפון</Label>
            <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>אימייל</Label>
            <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>אימייל לשליחת דוחות ללקוח</Label>
            <Input type="email" placeholder="client@example.com" value={form.report_email} onChange={(e) => setForm({ ...form, report_email: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={addNetwork.isPending || updateNetwork.isPending}>
            {(addNetwork.isPending || updateNetwork.isPending) ? "שומר..." : "שמור"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  const handleExport = () => {
    const rows: any[] = [];
    networks.forEach((n: any) => {
      const networkBranches = branches.filter((b: any) => b.network_id === n.id);
      if (networkBranches.length === 0) {
        rows.push({ "שם הרשת": n.name, "איש קשר": n.contact_name || "", "טלפון": n.contact_phone || "", "אימייל": n.contact_email || "", "סניף": "", "עיר": "", "כתובת": "" });
      } else {
        networkBranches.forEach((b: any) => {
          rows.push({ "שם הרשת": n.name, "איש קשר": n.contact_name || "", "טלפון": n.contact_phone || "", "אימייל": n.contact_email || "", "סניף": b.name, "עיר": b.city || "", "כתובת": b.address || "" });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "רשתות וסניפים");
    XLSX.writeFile(wb, "yarok360_networks.xlsx");
  };

  const handleDownloadTemplate = () => {
    const headers = ["שם הרשת", "איש קשר", "טלפון", "אימייל", "סניף", "עיר", "כתובת"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תבנית");
    XLSX.writeFile(wb, "yarok360_networks_template.xlsx");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImportingNetworks(true);
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws) as any[];
        if (!rows.length) { toast({ title: "הקובץ ריק", variant: "destructive" }); return; }

        const networkMap: Record<string, string> = {};
        let networksAdded = 0, branchesAdded = 0;

        for (const row of rows) {
          const networkName = row["שם הרשת"]?.toString().trim();
          if (!networkName) continue;

          if (!networkMap[networkName]) {
            const { data: existing } = await supabase.from("networks").select("id").eq("name", networkName).maybeSingle();
            if (existing) {
              networkMap[networkName] = existing.id;
              // Update network details if provided
              await supabase.from("networks").update({
                contact_name: row["איש קשר"] || null,
                contact_phone: row["טלפון"]?.toString() || null,
                contact_email: row["אימייל"] || null,
              }).eq("id", existing.id);
            } else {
              const { data: created, error } = await supabase.from("networks").insert({
                name: networkName,
                contact_name: row["איש קשר"] || null,
                contact_phone: row["טלפון"]?.toString() || null,
                contact_email: row["אימייל"] || null,
              }).select("id").single();
              if (error) throw error;
              networkMap[networkName] = created.id;
              networksAdded++;
            }
          }

          const branchName = row["סניף"]?.toString().trim();
          if (branchName) {
            const networkId = networkMap[networkName];
            const { data: existingBranch } = await supabase.from("branches").select("id").eq("name", branchName).eq("network_id", networkId).maybeSingle();
            if (!existingBranch) {
              const { error } = await supabase.from("branches").insert({
                name: branchName, network_id: networkId,
                city: row["עיר"] || null, address: row["כתובת"] || null,
              });
              if (!error) branchesAdded++;
            }
          }
        }

        qc.invalidateQueries({ queryKey: ["networks"] });
        qc.invalidateQueries({ queryKey: ["branches"] });
        toast({ title: `יובאו ${networksAdded} רשתות ו-${branchesAdded} סניפים בהצלחה` });
      } catch (err: any) {
        toast({ title: "שגיאת ייבוא", description: err.message, variant: "destructive" });
      } finally {
        setImportingNetworks(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">רשתות וסניפים</h1>
            <p className="text-muted-foreground text-sm mt-1">ניהול רשתות, סניפים ולקוחות</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileDown className="h-4 w-4 ml-1" />
              תבנית
            </Button>
            <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importingNetworks}>
              <Upload className="h-4 w-4 ml-1" />
              {importingNetworks ? "מייבא..." : "ייבוא"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={networks.length === 0}>
              <Download className="h-4 w-4 ml-1" />
              ייצוא ({networks.length})
            </Button>
            {networkFormDialog(false, open, setOpen)}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש רשתות..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Edit network dialog */}
        {networkFormDialog(true, !!editingNetwork, (v) => { if (!v) setEditingNetwork(null); })}

        {/* Branch dialog */}
        <Dialog open={branchDialogOpen} onOpenChange={(v) => { setBranchDialogOpen(v); if (!v) { setEditingBranch(null); setBranchForm(emptyBranch); } }}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingBranch ? "עריכת סניף" : "הוספת סניף חדש"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); editingBranch ? updateBranch.mutate() : addBranch.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>שם הסניף *</Label>
                <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>כתובת</Label>
                <Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>עיר</Label>
                <Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={addBranch.isPending || updateBranch.isPending}>
                {(addBranch.isPending || updateBranch.isPending) ? "שומר..." : "שמור"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="bg-card rounded-lg border shadow-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>שם הרשת</TableHead>
                <TableHead>איש קשר</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>סניפים</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    אין רשתות עדיין
                  </TableCell>
                </TableRow>
              ) : filtered.map((n: any) => {
                const networkBranches = branches.filter((b: any) => b.network_id === n.id);
                const isExpanded = expandedNetworks.has(n.id);
                return (
                  <>
                    <TableRow key={n.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpanded(n.id)}>
                      <TableCell>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{n.name}</TableCell>
                      <TableCell>{n.contact_name || "—"}</TableCell>
                      <TableCell>{n.contact_phone || "—"}</TableCell>
                      <TableCell>{n.contact_email || "—"}</TableCell>
                      <TableCell>{networkBranches.length}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEditNetwork(n)}>
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת רשת</AlertDialogTitle>
                                <AlertDialogDescription>
                                  האם אתה בטוח שברצונך למחוק את הרשת "{n.name}"?
                                  {networkBranches.length > 0 && ` לרשת זו ${networkBranches.length} סניפים שיימחקו גם כן.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteNetwork.mutate(n.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  מחק
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${n.id}-branches`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                סניפים ({networkBranches.length})
                              </h4>
                              <Button size="sm" variant="outline" onClick={() => openAddBranch(n.id)}>
                                <Plus className="h-3 w-3 ml-1" />
                                סניף חדש
                              </Button>
                            </div>
                            {networkBranches.length === 0 ? (
                              <p className="text-sm text-muted-foreground">אין סניפים עדיין</p>
                            ) : (
                              <div className="grid gap-2">
                                {networkBranches.map((b: any) => (
                                  <div key={b.id} className="flex items-center justify-between bg-card rounded-md border px-3 py-2">
                                    <div>
                                      <span className="font-medium text-sm">{b.name}</span>
                                      {(b.city || b.address) && (
                                        <span className="text-xs text-muted-foreground mr-2">
                                          {[b.city, b.address].filter(Boolean).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBranch(b)}>
                                        <Edit className="h-3 w-3 text-primary" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>מחיקת סניף</AlertDialogTitle>
                                            <AlertDialogDescription>האם אתה בטוח שברצונך למחוק את הסניף "{b.name}"?</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteBranch.mutate(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                              מחק
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
