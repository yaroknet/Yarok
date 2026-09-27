import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Button } from "@/employees/components/ui/button";
import { Textarea } from "@/employees/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Label } from "@/employees/components/ui/label";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppManualSend() {
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-profiles-for-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .not("phone", "is", null)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const handleSend = async () => {
    if (!selectedUser || !message.trim()) {
      toast.error("נא לבחור נמען ולהזין הודעה");
      return;
    }

    const user = users.find((u) => u.user_id === selectedUser);
    if (!user || !user.phone) {
      toast.error("משתמש ללא טלפון");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-notify", {
        body: {
          type: "summary",
          task: { message_body: message.trim(), assigned_to: user.user_id },
        },
      });

      if (error) throw error;
      toast.success(`הודעה נשלחה ל${user.full_name}`);
      setMessage("");
    } catch (err: any) {
      toast.error("שגיאה בשליחה: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">שליחת הודעת וואטסאפ ידנית</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>נמען</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="בחר משתמש..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.full_name || "ללא שם"} — {u.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>הודעה</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="הקלד את ההודעה כאן..."
            className="min-h-[120px]"
            dir="rtl"
          />
        </div>

        <Button onClick={handleSend} disabled={sending || !selectedUser || !message.trim()} className="gap-1.5">
          <Send className="h-4 w-4" />
          {sending ? "שולח..." : "שלח הודעה"}
        </Button>
      </CardContent>
    </Card>
  );
}
