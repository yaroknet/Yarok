import { useState } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Badge } from "@/employees/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Plus, Search, Download, Wrench, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ServiceManagementModal } from "@/employees/components/ServiceManagementModal";
import { ServiceStartProofViewer } from "@/employees/components/ServiceStartProofViewer";
import { EditServiceModal } from "@/employees/components/EditServiceModal";
import { useIsMobile } from "@/employees/hooks/use-mobile";
import { useToast } from "@/employees/hooks/use-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/employees/components/ui/alert-dialog";

const ACTION_LABELS: Record<string, string> = {
  start: "התחלת שירות",
  update: "עדכון שירות",
  stop: "הפסקת שירות",
};

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  completed: "הושלם",
  cancelled: "בוטל",
};

export default function AdminServices() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [proofViewServiceId, setProofViewServiceId] = useState<string | null>(null);
  const [proofViewServiceName, setProofViewServiceName] = useState("");
  const [search, setSearch] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterManager, setFilterManager] = useState("all");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-services"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
  });

  const getManagerName = (id: string | null) => {
    if (!id) return "—";
    return profiles.find((p: any) => p.user_id === id)?.full_name || "—";
  };

  // Unique networks for filter
  const uniqueNetworks = [...new Set(services.map((s: any) => s.network_name).filter(Boolean))].sort();
  const uniqueManagers = [...new Set(services.map((s: any) => s.manager_id).filter(Boolean))].map((id) => ({
    id,
    name: getManagerName(id),
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Filtered services
  const filtered = services.filter((s: any) => {
    if (filterNetwork !== "all" && s.network_name !== filterNetwork) return false;
    if (filterAction !== "all" && s.action_type !== filterAction) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterManager !== "all" && s.manager_id !== filterManager) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        s.network_name?.toLowerCase().includes(q) ||
        s.branch_name?.toLowerCase().includes(q) ||
        s.contact_person?.toLowerCase().includes(q) ||
        getManagerName(s.manager_id).toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const handleExport = () => {
    const rows = filtered.map((s: any) => ({
      "רשת": s.network_name,
      "סניף": s.branch_name,
      "סוג פעולה": ACTION_LABELS[s.action_type] || s.action_type,
      "סטטוס": STATUS_LABELS[s.status] || s.status,
      "איש קשר": s.contact_person || "",
      "טלפון": s.contact_phone || "",
      "מנהל אחראי": getManagerName(s.manager_id),
      "ימים בשבוע": s.days_per_week,
      "שעות לביקור": s.hours_per_visit,
      "שעות שבועיות": s.weekly_total,
      "לוגיסטיקה": (s.logistics || []).join(", "),
      "הערות": s.notes || "",
      "תאריך יעד": s.specific_date ? format(new Date(s.specific_date), "dd/MM/yyyy") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "שירותים");
    XLSX.writeFile(wb, `services_export_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const resetFilters = () => {
    setSearch("");
    setFilterNetwork("all");
    setFilterAction("all");
    setFilterStatus("all");
    setFilterManager("all");
  };

  const handleDelete = async () => {
    if (!deleteServiceId) return;
    try {
      const { error } = await supabase.from("services").delete().eq("id", deleteServiceId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "נמחק", description: "השירות נמחק בהצלחה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message || "שגיאה במחיקה", variant: "destructive" });
    } finally {
      setDeleteServiceId(null);
    }
  };

  const actionBadgeClass = (action: string) => {
    switch (action) {
      case "start": return "bg-primary/15 text-primary border-primary/30";
      case "update": return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300";
      case "stop": return "bg-destructive/15 text-destructive border-destructive/30";
      default: return "";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-right">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              ניהול שירות
            </h1>
            <p className="text-sm text-muted-foreground">ניהול ומעקב אחר שירותים</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              טופס חדש
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-4 w-4" />
              ייצוא Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-xl shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש חופשי..."
                    className="pr-9"
                  />
                </div>
              </div>
              <Select value={filterNetwork} onValueChange={setFilterNetwork}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="רשת" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הרשתות</SelectItem>
                  {uniqueNetworks.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="סוג פעולה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הפעולות</SelectItem>
                  <SelectItem value="start">התחלת שירות</SelectItem>
                  <SelectItem value="update">עדכון שירות</SelectItem>
                  <SelectItem value="stop">הפסקת שירות</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="completed">הושלם</SelectItem>
                  <SelectItem value="cancelled">בוטל</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterManager} onValueChange={setFilterManager}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="מנהל אחראי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המנהלים</SelectItem>
                  {uniqueManagers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
                איפוס סינון
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Count */}
        <p className="text-sm text-muted-foreground">{filtered.length} שירותים מוצגים מתוך {services.length}</p>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-xl shadow-sm border-0">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p>אין שירותים להצגה</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <Table style={{ tableLayout: "fixed" }}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right w-[120px]">רשת</TableHead>
                  <TableHead className="text-right w-[120px]">סניף</TableHead>
                  <TableHead className="text-right w-[110px]">סוג פעולה</TableHead>
                  <TableHead className="text-right w-[80px]">סטטוס</TableHead>
                  <TableHead className="text-right w-[100px]">מנהל</TableHead>
                  <TableHead className="text-right w-[70px]">ימים/שבוע</TableHead>
                  <TableHead className="text-right w-[70px]">שעות/ביקור</TableHead>
                  <TableHead className="text-right w-[80px]">שעות שבועיות</TableHead>
                  <TableHead className="text-right w-[90px]">תאריך יעד</TableHead>
                  <TableHead className="text-right w-[80px]">הוכחות</TableHead>
                  <TableHead className="text-right w-[100px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any, idx: number) => (
                  <TableRow
                    key={s.id}
                    className={`${idx % 2 === 0 ? "" : "bg-muted/30"} hover:bg-accent/50 transition-colors`}
                  >
                    <TableCell className="text-right font-medium text-sm">{s.network_name}</TableCell>
                    <TableCell className="text-right text-sm">{s.branch_name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={actionBadgeClass(s.action_type)}>
                        {ACTION_LABELS[s.action_type] || s.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{STATUS_LABELS[s.status] || s.status}</TableCell>
                    <TableCell className="text-right text-sm">{getManagerName(s.manager_id)}</TableCell>
                    <TableCell className="text-right text-sm">{s.days_per_week}</TableCell>
                    <TableCell className="text-right text-sm">{s.hours_per_visit}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{s.weekly_total || s.days_per_week * s.hours_per_visit}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {s.specific_date ? format(new Date(s.specific_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.action_type === "start" && (
                        <Button variant="ghost" size="sm" className="gap-1 text-xs"
                          onClick={() => { setProofViewServiceId(s.id); setProofViewServiceName(`${s.network_name} — ${s.branch_name}`); }}>
                          <Eye className="h-3.5 w-3.5" />צפה
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditService(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteServiceId(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ServiceManagementModal open={modalOpen} onOpenChange={setModalOpen} />
      <EditServiceModal open={!!editService} onOpenChange={(v) => { if (!v) setEditService(null); }} service={editService} />
      {proofViewServiceId && (
        <ServiceStartProofViewer
          open={!!proofViewServiceId}
          onClose={() => setProofViewServiceId(null)}
          serviceId={proofViewServiceId}
          serviceName={proofViewServiceName}
        />
      )}

      <AlertDialog open={!!deleteServiceId} onOpenChange={(v) => { if (!v) setDeleteServiceId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת שירות</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק שירות זה? פעולה זו אינה ניתנת לביטול.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
