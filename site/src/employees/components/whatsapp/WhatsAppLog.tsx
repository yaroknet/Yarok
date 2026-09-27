import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card, CardContent } from "@/employees/components/ui/card";
import { Badge } from "@/employees/components/ui/badge";
import { Input } from "@/employees/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "bg-green-100 text-green-800" },
  updated: { label: "עדכון", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "ביטול", color: "bg-red-100 text-red-800" },
  reminder: { label: "תזכורת", color: "bg-yellow-100 text-yellow-800" },
  summary: { label: "סיכום", color: "bg-purple-100 text-purple-800" },
};

export function WhatsAppLog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["whatsapp-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const filtered = logs.filter((log) => {
    if (typeFilter !== "all" && log.message_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (log.recipient_name || "").toLowerCase().includes(q) ||
        (log.message_body || "").toLowerCase().includes(q) ||
        (log.recipient_phone || "").includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="חיפוש לפי שם, טלפון או תוכן..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="כל הסוגים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="new">חדש</SelectItem>
            <SelectItem value="updated">עדכון</SelectItem>
            <SelectItem value="cancelled">ביטול</SelectItem>
            <SelectItem value="reminder">תזכורת</SelectItem>
            <SelectItem value="summary">סיכום</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground mr-auto">{filtered.length} הודעות</span>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">טוען...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">לא נמצאו הודעות</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((log) => {
            const typeInfo = TYPE_LABELS[log.message_type] || { label: log.message_type, color: "bg-muted text-muted-foreground" };
            return (
              <Card key={log.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{log.recipient_name || "לא ידוע"}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{log.recipient_phone}</span>
                        <Badge className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</Badge>
                        {log.webhook_status && (
                          <Badge variant={log.webhook_status === 200 ? "default" : "destructive"} className="text-xs">
                            {log.webhook_status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{log.message_body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: he })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
