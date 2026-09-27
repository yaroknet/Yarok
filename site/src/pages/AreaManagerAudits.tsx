import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Search,
  Eye,
  Download,
  Copy,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SUPER_PHARM_BRANCHES } from "@/lib/superPharmBranches";
import { ViewAuditDialog, AuditRecord } from "@/components/audits/ViewAuditDialog";

const PUBLIC_AUDIT_FORM_URL = "https://www.yaroknet.co.il/public/audit-form";

const AreaManagerAudits = () => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<AuditRecord | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("area_manager_audits")
      .select("*")
      .order("audit_date", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("שגיאה בטעינת ביקורות");
    } else {
      setAudits((data || []) as AuditRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Latest audit per branch
  const latestByBranch = useMemo(() => {
    const map = new Map<string, AuditRecord>();
    for (const a of audits) {
      if (!map.has(a.branch_name)) map.set(a.branch_name, a);
    }
    return map;
  }, [audits]);

  const rows = useMemo(() => {
    const list = SUPER_PHARM_BRANCHES.map((name) => {
      const last = latestByBranch.get(name);
      return { branch: name, last };
    });
    return list.filter((r) => {
      if (search && !r.branch.includes(search.trim())) return false;
      if (filter === "completed" && !r.last) return false;
      if (filter === "pending" && r.last) return false;
      return true;
    });
  }, [latestByBranch, filter, search]);

  const stats = useMemo(() => {
    const inspected = latestByBranch.size;
    const total = SUPER_PHARM_BRANCHES.length;
    const allScores: number[] = [];
    audits.forEach((a) => {
      if (a.average_satisfaction_score != null) allScores.push(Number(a.average_satisfaction_score));
    });
    const avgSat = allScores.length ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0;
    return { inspected, total, avgSat };
  }, [audits, latestByBranch]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_AUDIT_FORM_URL);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("שגיאה בהעתקת הקישור");
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div dir="rtl" className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/crm">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              חזרה
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">ביקורות מנהלי אזור</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy className="h-4 w-4" />
            העתק קישור לטופס
          </Button>
          <a href={PUBLIC_AUDIT_FORM_URL} target="_blank" rel="noreferrer">
            <Button variant="default" className="gap-2">
              פתיחת טופס ציבורי
            </Button>
          </a>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">סניפים שנבדקו</div>
            <div className="text-3xl font-bold">
              {stats.inspected}
              <span className="text-lg text-muted-foreground"> / {stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">ממוצע שביעות רצון</div>
            <div className="text-3xl font-bold">
              {stats.avgSat ? stats.avgSat.toFixed(2) : "-"}
              <span className="text-lg text-muted-foreground"> / 5</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">סך ביקורות שהוגשו</div>
            <div className="text-3xl font-bold">{audits.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">רשימת סניפים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם סניף..."
                className="pr-9"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">הכל</TabsTrigger>
                <TabsTrigger value="completed">בוצע</TabsTrigger>
                <TabsTrigger value="pending">טרם בוצע</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right">
                    <th className="py-2 px-2">סניף</th>
                    <th className="py-2 px-2">סטטוס</th>
                    <th className="py-2 px-2">תאריך אחרון</th>
                    <th className="py-2 px-2">מנהל אזור</th>
                    <th className="py-2 px-2">ציון ממוצע</th>
                    <th className="py-2 px-2 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.branch} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2 font-medium">{r.branch}</td>
                      <td className="py-2 px-2">
                        {r.last ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> בוצע
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="h-3 w-3" /> טרם בוצע
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">{r.last ? formatDate(r.last.audit_date) : "-"}</td>
                      <td className="py-2 px-2">{r.last?.area_manager_name || "-"}</td>
                      <td className="py-2 px-2">
                        {r.last?.average_area_score != null && r.last?.average_satisfaction_score != null
                          ? (
                              (Number(r.last.average_area_score) + Number(r.last.average_satisfaction_score)) /
                              2
                            ).toFixed(2)
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {r.last && (
                          <Button size="sm" variant="ghost" onClick={() => setViewing(r.last!)} className="gap-1">
                            <Eye className="h-4 w-4" /> צפייה
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        לא נמצאו תוצאות
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">היסטוריית הגשות</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">אין ביקורות עדיין</p>
          ) : (
            <div className="space-y-2">
              {audits.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-3 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{a.branch_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(a.audit_date)} · {a.area_manager_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      אזור: {Number(a.average_area_score || 0).toFixed(2)}
                    </Badge>
                    <Badge variant="outline">
                      שביעות: {Number(a.average_satisfaction_score || 0).toFixed(2)}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => setViewing(a)} className="gap-1">
                      <Eye className="h-4 w-4" /> צפייה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ViewAuditDialog audit={viewing} onClose={() => setViewing(null)} />
    </div>
  );
};

export default AreaManagerAudits;
