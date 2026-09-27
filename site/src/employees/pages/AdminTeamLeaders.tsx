import { useState, useMemo } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/employees/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/employees/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Badge } from "@/employees/components/ui/badge";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Plus, Trash2, KeyRound, Pencil, Lock, Search } from "lucide-react";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/employees/hooks/use-toast";
import { useIsMobile } from "@/employees/hooks/use-mobile";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "מנהל על",
  office_manager: "מנהל משרד",
  team_leader: "משתמש מערכת",
  contractor: "קבלן",
  contractor_worker: "עובד קבלן",
};

export default function AdminTeamLeaders() {
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", role: "" });
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "team_leader" });
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { roles: currentUserRoles } = useAuth();
  const isSuperAdmin = currentUserRoles.includes("super_admin");
  const isAdminRole = (userRoles: string[]) =>
    userRoles?.some((r: string) => r === "super_admin" || r === "office_manager");
  const canManage = (u: any) => isSuperAdmin || !isAdminRole(u.roles);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managed-users"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      if (!roles.length) return [];
      const userIds = [...new Set(roles.map((r: any) => r.user_id))];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);
      if (pErr) throw pErr;
      return (profiles || []).map((p: any) => {
        const userRoles = roles.filter((r: any) => r.user_id === p.user_id);
        return { ...p, roles: userRoles.map((r: any) => r.role) };
      });
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("create-user", {
        body: { email: form.email, password: form.password, full_name: form.full_name, phone: form.phone || null, role: form.role },
      });
      if (res.error) throw new Error(res.error.message || "שגיאה ביצירת משתמש");
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", role: "team_leader" });
      toast({ title: "משתמש נוצר בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!resetTarget) return;
      const res = await supabase.functions.invoke("update-password", {
        body: { email: resetTarget.email, password: newPassword },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setResetOpen(false);
      setNewPassword("");
      setResetTarget(null);
      toast({ title: "סיסמה אופסה בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      if (!editForm.email && !editForm.phone) {
        throw new Error("יש להזין אימייל או טלפון לפחות");
      }
      const { error: profileErr, data: updatedProfile } = await supabase
        .from("profiles")
        .update({ 
          full_name: editForm.full_name, 
          email: editForm.email || null,
          phone: editForm.phone || null 
        })
        .eq("user_id", editTarget.user_id)
        .select()
        .single();
      if (profileErr) throw profileErr;
      if (!updatedProfile) throw new Error("העדכון נכשל - לא התקבל אישור מהמסד");

      const currentRole = editTarget.roles?.[0];
      if (editForm.role && editForm.role !== currentRole) {
        const { error: delErr } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editTarget.user_id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: editTarget.user_id, role: editForm.role as any });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      qc.invalidateQueries({ queryKey: ["team-leaders-select"] });
      setEditOpen(false);
      setEditTarget(null);
      toast({ title: "משתמש עודכן בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      toast({ title: "משתמש הוסר" });
    },
  });

  const openEdit = (u: any) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name || "", email: u.email || "", phone: u.phone || "", role: u.roles?.[0] || "team_leader" });
    setEditOpen(true);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u: any) =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  }, [users, searchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ניהול משתמשים</h1>
            <p className="text-muted-foreground text-sm mt-1">ניהול כל המשתמשים במערכת</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4 ml-2" />
                משתמש חדש
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className={isMobile ? "max-w-full h-full max-h-full rounded-none" : ""}>
              <DialogHeader>
                <DialogTitle>יצירת משתמש חדש</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                if (!form.email && !form.phone) {
                  toast({ title: "שגיאה", description: "יש להזין אימייל או טלפון לפחות", variant: "destructive" });
                  return;
                }
                createUser.mutate(); 
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label>שם מלא *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>אימייל</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="לא חובה אם יש טלפון" />
                </div>
                <div className="space-y-2">
                  <Label>טלפון</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="לא חובה אם יש אימייל" />
                </div>
                <div className="space-y-2">
                  <Label>תפקיד *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && <SelectItem value="super_admin">מנהל על</SelectItem>}
                      {isSuperAdmin && <SelectItem value="office_manager">מנהל משרד</SelectItem>}
                      <SelectItem value="team_leader">משתמש מערכת</SelectItem>
                      <SelectItem value="contractor">קבלן</SelectItem>
                      <SelectItem value="contractor_worker">עובד קבלן</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סיסמה *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? "יוצר..." : "צור משתמש"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit User Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent dir="rtl" className={isMobile ? "max-w-full h-full max-h-full rounded-none" : ""}>
            <DialogHeader>
              <DialogTitle>עריכת משתמש — {editTarget?.email}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); updateUser.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>שם מלא</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="לא חובה אם יש טלפון" />
              </div>
              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="לא חובה אם יש אימייל" />
              </div>
              <div className="space-y-2">
                <Label>תפקיד</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })} disabled={!isSuperAdmin && isAdminRole(editTarget?.roles || [])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin">מנהל על</SelectItem>}
                    {isSuperAdmin && <SelectItem value="office_manager">מנהל משרד</SelectItem>}
                    <SelectItem value="team_leader">משתמש מערכת</SelectItem>
                    <SelectItem value="contractor">קבלן</SelectItem>
                    <SelectItem value="contractor_worker">עובד קבלן</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={updateUser.isPending}>
                {updateUser.isPending ? "מעדכן..." : "עדכן משתמש"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>איפוס סיסמה — {resetTarget?.email}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); resetPassword.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>סיסמה חדשה</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "מאפס..." : "אפס סיסמה"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <div className="relative max-w-md" dir="rtl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי שם, אימייל או טלפון..."
            className="pr-10"
          />
        </div>

        {/* Mobile: Card layout */}
        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">טוען...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{searchQuery ? "לא נמצאו תוצאות" : "אין משתמשים"}</div>
            ) : filteredUsers.map((u: any) => (
              <Card key={u.id} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{u.full_name || "—"}</h3>
                      <p className="text-sm text-muted-foreground">{u.email || "—"}</p>
                      {u.phone && <p className="text-sm text-muted-foreground">{u.phone}</p>}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles?.map((r: string) => (
                        <Badge key={r} variant="secondary" className="text-xs">{ROLE_LABELS[r] || r}</Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">נוצר: {new Date(u.created_at).toLocaleDateString("he-IL")}</p>
                  <div className="flex items-center gap-2">
                    {canManage(u) ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5 ml-1" />עריכה
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setResetTarget({ id: u.user_id, email: u.email || u.full_name });
                          setResetOpen(true);
                        }}>
                          <KeyRound className="h-3.5 w-3.5 ml-1" />סיסמה
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteUser.mutate(u.user_id)}>
                          <Trash2 className="h-3.5 w-3.5 ml-1" />מחיקה
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Lock className="h-3.5 w-3.5" />
                        <span>נעול – ניהול ע"י מנהל על בלבד</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-lg border shadow-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>נוצר</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {isLoading ? "טוען..." : searchQuery ? "לא נמצאו תוצאות" : "אין משתמשים"}
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>{u.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles?.map((r: string) => (
                          <Badge key={r} variant="secondary" className="text-xs">{ROLE_LABELS[r] || r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(u.created_at).toLocaleDateString("he-IL")}</TableCell>
                    <TableCell>
                      {canManage(u) ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="עריכה">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setResetTarget({ id: u.user_id, email: u.email || u.full_name });
                            setResetOpen(true);
                          }} title="איפוס סיסמה">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteUser.mutate(u.user_id)} title="מחיקה">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Lock className="h-3.5 w-3.5" />
                          <span>נעול</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
