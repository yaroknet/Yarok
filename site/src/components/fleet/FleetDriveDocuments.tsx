import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft, Download, FileText, Folder, FolderOpen,
  LayoutGrid, List as ListIcon, MoreVertical, Pencil, RefreshCw, Search,
  Trash2, Upload, Car, Sparkles,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "./utils";
import { SmartDocReviewDialog, SmartDocStatusBadge, isSmartDocType, analyzeDoc } from "./SmartDocReview";

export const DOC_CATEGORIES = [
  "רישיון רכב",
  "ביטוח",
  "רישיון נהיגה",
  "טפסי מסירה/החזרה",
  "ייפוי כוח",
  "קנסות",
  "טיפולים",
  "אחר",
];

type Doc = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  doc_type: string;
  title: string;
  file_url: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  analysis_status?: string | null;
  extracted_data?: Record<string, any> | null;
  analysis_notes?: string | null;
  fleet_vehicles?: { license_plate: string; make?: string; model?: string } | null;
  fleet_drivers?: { full_name: string } | null;
};

async function uploadFile(file: File): Promise<string | null> {
  const path = `documents/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("fleet-files").upload(path, file, { upsert: false });
  if (error) { toast.error(error.message); return null; }
  const { data } = await supabase.storage.from("fleet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

export function FleetDriveDocuments({ vehicleId }: { vehicleId?: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [currentDriverByVehicle, setCurrentDriverByVehicle] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openVehicle, setOpenVehicle] = useState<string | null>(vehicleId ?? null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [renaming, setRenaming] = useState<Doc | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<Doc | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ vehicle_id: string | null; doc_type: string } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const [d, v, dr, asg] = await Promise.all([
      supabase.from("fleet_documents")
        .select("*, fleet_vehicles(license_plate,make,model,driver_id), fleet_drivers(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("fleet_vehicles").select("id,license_plate,make,model,driver_id").order("license_plate"),
      supabase.from("fleet_drivers").select("id,full_name").order("full_name"),
      supabase.from("fleet_driver_assignments").select("vehicle_id,driver_id,start_date").is("end_date", null),
    ]);
    setDocs((d.data as any) ?? []);
    setVehicles(v.data ?? []);
    setDrivers(dr.data ?? []);
    // Build current-driver map: prefer active assignment, fall back to vehicles.driver_id
    const map: Record<string, string> = {};
    for (const veh of (v.data ?? []) as any[]) if (veh.driver_id) map[veh.id] = veh.driver_id;
    for (const a of (asg.data ?? []) as any[]) if (a.driver_id) map[a.vehicle_id] = a.driver_id;
    setCurrentDriverByVehicle(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (vehicleId) setOpenVehicle(vehicleId); }, [vehicleId]);

  const driverNameById = (id?: string | null) => drivers.find(x => x.id === id)?.full_name ?? null;

  // Apply filters (search + driver + type) to a base list
  const applyFilters = (list: Doc[]) => {
    const s = q.trim();
    return list.filter(d => {
      if (filterDriver !== "all" && d.driver_id !== filterDriver) return false;
      if (filterType !== "all" && d.doc_type !== filterType) return false;
      if (!s) return true;
      const hay = [d.title, d.doc_type, d.notes, d.fleet_vehicles?.license_plate, d.fleet_drivers?.full_name].filter(Boolean).join(" ");
      return hay.includes(s);
    });
  };

  const scopedDocs = useMemo(() => vehicleId ? docs.filter(d => d.vehicle_id === vehicleId) : docs, [docs, vehicleId]);
  const visibleDocs = useMemo(() => applyFilters(scopedDocs), [scopedDocs, q, filterDriver, filterType]);

  // Group by vehicle
  const byVehicle = useMemo(() => {
    const map = new Map<string, Doc[]>();
    for (const d of visibleDocs) {
      const k = d.vehicle_id ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return map;
  }, [visibleDocs]);

  // Group by category inside vehicle
  const byCategory = (vId: string | null) => {
    const list = visibleDocs.filter(d => (d.vehicle_id ?? "__none__") === (vId ?? "__none__"));
    const map = new Map<string, Doc[]>();
    for (const cat of DOC_CATEGORIES) map.set(cat, []);
    for (const d of list) {
      const cat = DOC_CATEGORIES.includes(d.doc_type) ? d.doc_type : "אחר";
      map.get(cat)!.push(d);
    }
    return map;
  };

  const currentVehicle = openVehicle ? vehicles.find(v => v.id === openVehicle) : null;

  const handleFiles = async (files: FileList | File[], target?: { vehicle_id: string | null; doc_type: string }) => {
    const t = target ?? uploadTarget ?? { vehicle_id: openVehicle, doc_type: openCategory ?? "אחר" };
    const arr = Array.from(files);
    if (!arr.length) return;
    let ok = 0;
    const insertedIds: string[] = [];
    for (const file of arr) {
      const url = await uploadFile(file);
      if (!url) continue;
      const { data: inserted, error } = await supabase.from("fleet_documents").insert({
        vehicle_id: t.vehicle_id, doc_type: t.doc_type,
        title: file.name.replace(/\.[^.]+$/, ""), file_url: url,
        analysis_status: isSmartDocType(t.doc_type) ? "pending" : "ignored",
      }).select("id").maybeSingle();
      if (error) toast.error(error.message);
      else { ok++; if (inserted?.id && isSmartDocType(t.doc_type)) insertedIds.push(inserted.id); }
    }
    if (ok) toast.success(`הועלו ${ok} קבצים`);
    setUploadTarget(null);
    load();
    // fire-and-forget AI analysis for smart docs
    if (insertedIds.length) {
      toast.info(`מפעיל סריקה חכמה ל-${insertedIds.length} מסמכים...`);
      Promise.all(insertedIds.map((id) => analyzeDoc(id))).then((results) => {
        const failed = results.filter((r) => !r.ok).length;
        if (failed) toast.warning(`${failed} מסמכים נכשלו בסריקה — פתח/י אותם לבדיקה`);
        else toast.success("סריקה חכמה הושלמה — לחץ/י על מסמך לאישור");
        load();
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (openCategory) handleFiles(e.dataTransfer.files, { vehicle_id: openVehicle, doc_type: openCategory });
    else toast.info("היכנס/י לתיקיית קטגוריה כדי להעלות בגרירה");
  };

  const del = async (d: Doc) => {
    if (!confirm(`למחוק "${d.title}"?`)) return;
    const { error } = await supabase.from("fleet_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("נמחק"); load();
  };
  const replaceFile = async (d: Doc) => {
    const inp = document.createElement("input"); inp.type = "file";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const url = await uploadFile(f); if (!url) return;
      const { error } = await supabase.from("fleet_documents").update({ file_url: url }).eq("id", d.id);
      if (error) return toast.error(error.message);
      toast.success("הקובץ הוחלף"); load();
    };
    inp.click();
  };

  // Breadcrumbs & header
  const Breadcrumbs = () => (
    <div className="flex items-center gap-1 text-sm">
      {!vehicleId && (
        <Button variant="ghost" size="sm" onClick={() => { setOpenVehicle(null); setOpenCategory(null); }}>
          <Folder className="h-4 w-4 ml-1" /> רכבים
        </Button>
      )}
      {openVehicle && (
        <>
          <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
          <Button variant="ghost" size="sm" onClick={() => setOpenCategory(null)}>
            <Car className="h-4 w-4 ml-1" />
            {currentVehicle?.license_plate ?? "ללא רכב"}
          </Button>
        </>
      )}
      {openCategory && (
        <>
          <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
          <span className="px-2">{openCategory}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3" dir="rtl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Breadcrumbs />
        <div className="mr-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="חיפוש בקבצים..." value={q} onChange={e => setQ(e.target.value)} className="pr-8 w-56" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="סוג מסמך" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסוגים</SelectItem>
              {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDriver} onValueChange={setFilterDriver}>
            <SelectTrigger className="w-40"><SelectValue placeholder="נהג" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הנהגים</SelectItem>
              {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex border rounded overflow-hidden">
            <Button size="icon" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button size="icon" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></Button>
          </div>
          <Button onClick={() => setUploadTarget({ vehicle_id: openVehicle, doc_type: openCategory ?? "אחר" })}>
            <Upload className="h-4 w-4 ml-1" /> העלאה
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">טוען...</Card>
      ) : view === "list" ? (
        <FilesTable rows={visibleDocs} onOpen={d => d.file_url && window.open(d.file_url, "_blank")} onRename={setRenaming} onDelete={del} onReplace={replaceFile} onReview={setReviewingDoc} />
      ) : !openVehicle ? (
        // Root: vehicle folders
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {vehicles.map(v => {
            const count = byVehicle.get(v.id)?.length ?? 0;
            const driverName = driverNameById(currentDriverByVehicle[v.id]);
            const vehicleLine = `${[v.make, v.model].filter(Boolean).join(" ") || "רכב"} | ${v.license_plate}`;
            return (
              <FolderCard key={v.id}
                title={driverName ?? "ללא נהג משויך"}
                subtitle={vehicleLine}
                count={count}
                onOpen={() => { setOpenVehicle(v.id); setOpenCategory(null); }} />
            );
          })}
          {(byVehicle.get("__none__")?.length ?? 0) > 0 && (
            <FolderCard title="ללא שיוך" subtitle="מסמכים כלליים" count={byVehicle.get("__none__")!.length}
              onOpen={() => { setOpenVehicle("__none__"); setOpenCategory(null); }} />
          )}
        </div>
      ) : !openCategory ? (
        // Inside vehicle: category folders
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from(byCategory(openVehicle).entries()).map(([cat, list]) => (
            <FolderCard key={cat} title={cat} subtitle="תיקיית מסמכים" count={list.length}
              onOpen={() => setOpenCategory(cat)}
              onUpload={() => setUploadTarget({ vehicle_id: openVehicle === "__none__" ? null : openVehicle, doc_type: cat })} />
          ))}
        </div>
      ) : (
        // Inside category: files
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="min-h-[300px] border-2 border-dashed border-transparent rounded-lg p-1 transition"
          style={{ borderColor: "transparent" }}>
          <FilesGrid
            rows={(byCategory(openVehicle).get(openCategory) ?? [])}
            emptyHint="גרור/י קבצים לכאן או לחץ/י על 'העלאה'"
            onOpen={d => d.file_url && window.open(d.file_url, "_blank")}
            onRename={setRenaming}
            onDelete={del}
            onReplace={replaceFile}
            onReview={setReviewingDoc}
          />
        </div>
      )}

      {/* Rename dialog */}
      <RenameDialog doc={renaming} onClose={() => setRenaming(null)} onSaved={load} vehicles={vehicles} drivers={drivers} />
      {/* Upload dialog */}
      <UploadDialog target={uploadTarget} vehicles={vehicles} onClose={() => setUploadTarget(null)} onFiles={handleFiles} />
      {/* Smart-doc review dialog */}
      <SmartDocReviewDialog doc={reviewingDoc as any} onClose={() => setReviewingDoc(null)} onDone={load} />
    </div>
  );
}

function FolderCard({ title, subtitle, count, onOpen, onUpload }: { title: string; subtitle?: string; count: number; onOpen: () => void; onUpload?: () => void }) {
  return (
    <Card className="p-4 hover:shadow-md hover:border-primary/40 cursor-pointer transition group relative" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-primary/10 text-primary group-hover:bg-primary/20">
          <FolderOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
          <div className="text-xs text-muted-foreground mt-1">{count} קבצים</div>
        </div>
        {onUpload && (
          <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); onUpload(); }} title="העלאה">
            <Upload className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function FilesGrid({ rows, emptyHint, onOpen, onRename, onDelete, onReplace, onReview }: { rows: Doc[]; emptyHint: string; onOpen: (d: Doc) => void; onRename: (d: Doc) => void; onDelete: (d: Doc) => void; onReplace: (d: Doc) => void; onReview: (d: Doc) => void }) {
  if (!rows.length) return (
    <Card className="p-8 text-center text-muted-foreground text-sm">
      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
      {emptyHint}
    </Card>
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {rows.map(d => {
        const smart = isSmartDocType(d.doc_type);
        return (
          <Card key={d.id} className="p-3 hover:shadow-md hover:border-primary/40 transition relative group">
            <div className="cursor-pointer" onClick={() => smart ? onReview(d) : onOpen(d)}>
              <div className="aspect-square rounded bg-muted/40 flex items-center justify-center mb-2 relative">
                <FileText className="h-10 w-10 text-primary/70" />
                {smart && (
                  <div className="absolute top-1 right-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                )}
              </div>
              <div className="font-medium text-sm truncate" title={d.title}>{d.title}</div>
              <div className="text-xs text-muted-foreground truncate">{d.doc_type}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {d.expiry_date && <Badge variant="outline" className="text-[10px]">תוקף: {fmtDate(d.expiry_date)}</Badge>}
                <SmartDocStatusBadge status={d.analysis_status} docType={d.doc_type} />
              </div>
            </div>
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onOpen(d)}><Download className="h-4 w-4 ml-2" />צפייה/הורדה</DropdownMenuItem>
                  {smart && <DropdownMenuItem onClick={() => onReview(d)}><Sparkles className="h-4 w-4 ml-2" />נתונים חכמים</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => onRename(d)}><Pencil className="h-4 w-4 ml-2" />שינוי שם/פרטים</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onReplace(d)}><RefreshCw className="h-4 w-4 ml-2" />החלפת קובץ</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(d)}><Trash2 className="h-4 w-4 ml-2" />מחיקה</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FilesTable({ rows, onOpen, onRename, onDelete, onReplace, onReview }: { rows: Doc[]; onOpen: (d: Doc) => void; onRename: (d: Doc) => void; onDelete: (d: Doc) => void; onReplace: (d: Doc) => void; onReview: (d: Doc) => void }) {
  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>שם</TableHead><TableHead>סוג</TableHead><TableHead>סטטוס</TableHead><TableHead>רכב</TableHead>
          <TableHead>נהג</TableHead><TableHead>תוקף</TableHead><TableHead>נוצר</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(d => {
            const smart = isSmartDocType(d.doc_type);
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => smart ? onReview(d) : onOpen(d)}>{d.title}</TableCell>
                <TableCell>{d.doc_type}</TableCell>
                <TableCell><SmartDocStatusBadge status={d.analysis_status} docType={d.doc_type} /></TableCell>
                <TableCell>{d.fleet_vehicles?.license_plate ?? "-"}</TableCell>
                <TableCell>{d.fleet_drivers?.full_name ?? "-"}</TableCell>
                <TableCell>{fmtDate(d.expiry_date)}</TableCell>
                <TableCell>{fmtDate(d.created_at)}</TableCell>
                <TableCell className="text-left">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpen(d)}><Download className="h-4 w-4 ml-2" />צפייה/הורדה</DropdownMenuItem>
                      {smart && <DropdownMenuItem onClick={() => onReview(d)}><Sparkles className="h-4 w-4 ml-2" />נתונים חכמים</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => onRename(d)}><Pencil className="h-4 w-4 ml-2" />שינוי פרטים</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onReplace(d)}><RefreshCw className="h-4 w-4 ml-2" />החלפת קובץ</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(d)}><Trash2 className="h-4 w-4 ml-2" />מחיקה</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">אין מסמכים.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function RenameDialog({ doc, onClose, onSaved, vehicles, drivers }: { doc: Doc | null; onClose: () => void; onSaved: () => void; vehicles: any[]; drivers: any[] }) {
  const [f, setF] = useState<any>({});
  useEffect(() => { setF(doc ?? {}); }, [doc]);
  if (!doc) return null;
  const save = async () => {
    const { error } = await supabase.from("fleet_documents").update({
      title: f.title, doc_type: f.doc_type, expiry_date: f.expiry_date || null,
      vehicle_id: f.vehicle_id || null, driver_id: f.driver_id || null, notes: f.notes || null,
    }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("נשמר"); onSaved(); onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>עריכת פרטי מסמך</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label className="text-xs">שם קובץ</Label><Input value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">סוג</Label>
            <Select value={f.doc_type ?? "אחר"} onValueChange={v => setF({ ...f, doc_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">תוקף</Label><Input type="date" value={f.expiry_date ?? ""} onChange={e => setF({ ...f, expiry_date: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">רכב</Label>
            <Select value={f.vehicle_id ?? "none"} onValueChange={v => setF({ ...f, vehicle_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא</SelectItem>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">נהג</Label>
            <Select value={f.driver_id ?? "none"} onValueChange={v => setF({ ...f, driver_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא</SelectItem>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button onClick={save}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ target, vehicles, onClose, onFiles }: { target: { vehicle_id: string | null; doc_type: string } | null; vehicles: any[]; onClose: () => void; onFiles: (files: FileList, t: { vehicle_id: string | null; doc_type: string }) => void }) {
  const [t, setT] = useState<{ vehicle_id: string | null; doc_type: string }>({ vehicle_id: null, doc_type: "אחר" });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (target) setT({ vehicle_id: target.vehicle_id === "__none__" ? null : target.vehicle_id, doc_type: target.doc_type || "אחר" }); }, [target]);
  if (!target) return null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>העלאת קבצים</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">רכב</Label>
            <Select value={t.vehicle_id ?? "none"} onValueChange={v => setT({ ...t, vehicle_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent><SelectItem value="none">ללא</SelectItem>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">סוג</Label>
            <Select value={t.doc_type} onValueChange={v => setT({ ...t, doc_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) { onFiles(e.dataTransfer.files, t); onClose(); } }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/30"
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
          <div className="text-sm">גרור/י קבצים לכאן או לחץ/י לבחירה</div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) { onFiles(e.target.files, t); onClose(); } }} />
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>סגירה</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
