import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Phone, 
  Mail, 
  Calendar, 
  User, 
  MessageSquare, 
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Loader2,
  Search
} from "lucide-react";

type ContactInquiry = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  status: string;
  handled_by: string | null;
  handled_at: string | null;
  handling_notes: string | null;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "חדש", color: "destructive" },
  in_progress: { label: "בטיפול", color: "secondary" },
  completed: { label: "טופל", color: "default" },
};

const ContactInquiriesManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHandleOpen, setIsHandleOpen] = useState(false);
  const [handlingNotes, setHandlingNotes] = useState("");
  const [newStatus, setNewStatus] = useState("completed");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: inquiries, isLoading } = useQuery({
    queryKey: ["contact-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContactInquiry[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("contact_inquiries")
        .update({
          status,
          handling_notes: notes,
          handled_by: user?.id,
          handled_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-inquiries"] });
      toast.success("הפנייה עודכנה בהצלחה");
      setIsHandleOpen(false);
      setHandlingNotes("");
    },
    onError: () => {
      toast.error("אירעה שגיאה בעדכון הפנייה");
    },
  });

  const handleExportExcel = () => {
    if (!inquiries?.length) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const headers = ["שם מלא", "אימייל", "טלפון", "הודעה", "סטטוס", "תאריך יצירה", "הערות טיפול", "תאריך טיפול"];
    const rows = inquiries.map((inquiry) => [
      inquiry.full_name,
      inquiry.email,
      inquiry.phone || "",
      inquiry.message,
      statusLabels[inquiry.status]?.label || inquiry.status,
      format(new Date(inquiry.created_at), "dd/MM/yyyy HH:mm"),
      inquiry.handling_notes || "",
      inquiry.handled_at ? format(new Date(inquiry.handled_at), "dd/MM/yyyy HH:mm") : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contact_inquiries_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ יוצא בהצלחה");
  };

  const filteredInquiries = inquiries?.filter((inquiry) => {
    const matchesSearch =
      inquiry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.phone?.includes(searchTerm) ||
      inquiry.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || inquiry.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openViewDialog = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setIsViewOpen(true);
  };

  const openHandleDialog = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setHandlingNotes(inquiry.handling_notes || "");
    setNewStatus(inquiry.status === "completed" ? "completed" : "completed");
    setIsHandleOpen(true);
  };

  const handleSubmitUpdate = () => {
    if (!selectedInquiry) return;
    updateMutation.mutate({
      id: selectedInquiry.id,
      status: newStatus,
      notes: handlingNotes,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול פניות יצירת קשר</h1>
          <p className="text-muted-foreground">צפייה וטיפול בפניות מטופס יצירת הקשר</p>
        </div>
        <Button onClick={handleExportExcel} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          ייצוא לאקסל
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inquiries?.filter((i) => i.status === "new").length || 0}</p>
                <p className="text-sm text-muted-foreground">פניות חדשות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary/10">
                <Clock className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inquiries?.filter((i) => i.status === "in_progress").length || 0}</p>
                <p className="text-sm text-muted-foreground">בטיפול</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inquiries?.filter((i) => i.status === "completed").length || 0}</p>
                <p className="text-sm text-muted-foreground">טופלו</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, אימייל, טלפון..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="סינון לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
                <SelectItem value="in_progress">בטיפול</SelectItem>
                <SelectItem value="completed">טופל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם מלא</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInquiries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      לא נמצאו פניות
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries?.map((inquiry) => (
                    <TableRow key={inquiry.id}>
                      <TableCell className="font-medium">{inquiry.full_name}</TableCell>
                      <TableCell>{inquiry.email}</TableCell>
                      <TableCell dir="ltr" className="text-right">{inquiry.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[inquiry.status]?.color || "outline"}>
                          {statusLabels[inquiry.status]?.label || inquiry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(inquiry.created_at), "dd/MM/yyyy", { locale: he })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openViewDialog(inquiry)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openHandleDialog(inquiry)}>
                            טיפול
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי פנייה</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">שם מלא</p>
                  <p className="font-medium">{selectedInquiry.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">אימייל</p>
                  <p className="font-medium">{selectedInquiry.email}</p>
                </div>
              </div>
              {selectedInquiry.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">טלפון</p>
                    <p className="font-medium" dir="ltr">{selectedInquiry.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">תאריך פנייה</p>
                  <p className="font-medium">
                    {format(new Date(selectedInquiry.created_at), "dd/MM/yyyy HH:mm", { locale: he })}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">הודעה</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedInquiry.message}</p>
                </div>
              </div>
              {selectedInquiry.handling_notes && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">הערות טיפול</p>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="whitespace-pre-wrap">{selectedInquiry.handling_notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Handle Dialog */}
      <Dialog open={isHandleOpen} onOpenChange={setIsHandleOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>טיפול בפנייה</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">הודעה מ: {selectedInquiry.full_name}</p>
                <p className="whitespace-pre-wrap text-sm">{selectedInquiry.message}</p>
              </div>
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">בטיפול</SelectItem>
                    <SelectItem value="completed">טופל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>תיאור הטיפול</Label>
                <Textarea
                  value={handlingNotes}
                  onChange={(e) => setHandlingNotes(e.target.value)}
                  placeholder="תאר כיצד טופלה הפנייה..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHandleOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmitUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                "שמור"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactInquiriesManagement;
