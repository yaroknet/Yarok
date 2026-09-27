import { useState, useMemo } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/employees/components/ui/tabs";
import { ScrollArea } from "@/employees/components/ui/scroll-area";
import { MessageSquare, Eye, Users, Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/employees/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { MessagesTab } from "@/employees/components/team-leader/MessagesTab";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/employees/components/ui/select";

function formatMessageDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "היום";
  if (isYesterday(date)) return "אתמול";
  return format(date, "dd/MM/yyyy");
}

interface ChatMessage {
  id: string;
  body: string;
  sender_id: string;
  recipient_id: string;
  is_read: boolean;
  created_at: string;
  media_url: string | null;
}

export default function AdminMessages() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [tab, setTab] = useState<"chat" | "archive">("chat");

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">הודעות</h1>
            <p className="text-muted-foreground text-sm mt-1">שיחות פנימיות בין משתמשי המערכת</p>
          </div>
        </div>

        {isSuperAdmin ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} dir="rtl">
            <TabsList>
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                השיחות שלי
              </TabsTrigger>
              <TabsTrigger value="archive" className="gap-1.5">
                <Eye className="h-4 w-4" />
                ארכיון שיחות
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat">
              <MessagesTab variant="desktop" />
            </TabsContent>
            <TabsContent value="archive">
              <ArchiveView />
            </TabsContent>
          </Tabs>
        ) : (
          <MessagesTab variant="desktop" />
        )}
      </div>
    </AdminLayout>
  );
}

/* ─── Super Admin archive: view all users' conversations ─── */
function ArchiveView() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPeerId, setSelectedPeerId] = useState<string>("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["archive-all-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return (data || []).sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));
    },
  });

  const { data: peers = [] } = useQuery({
    queryKey: ["archive-peers", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data: messages } = await supabase
        .from("internal_messages")
        .select("sender_id, recipient_id")
        .or(`sender_id.eq.${selectedUserId},recipient_id.eq.${selectedUserId}`);
      const peerIds = new Set<string>();
      (messages || []).forEach((m: any) => {
        if (m.sender_id !== selectedUserId) peerIds.add(m.sender_id);
        if (m.recipient_id !== selectedUserId) peerIds.add(m.recipient_id);
      });
      return allUsers.filter((u: any) => peerIds.has(u.user_id));
    },
    enabled: !!selectedUserId,
  });

  const { data: conversation = [] } = useQuery({
    queryKey: ["archive-conversation", selectedUserId, selectedPeerId],
    queryFn: async () => {
      if (!selectedUserId || !selectedPeerId) return [];
      const { data } = await supabase
        .from("internal_messages")
        .select("*")
        .or(`and(sender_id.eq.${selectedUserId},recipient_id.eq.${selectedPeerId}),and(sender_id.eq.${selectedPeerId},recipient_id.eq.${selectedUserId})`)
        .order("created_at", { ascending: true });
      return (data || []) as ChatMessage[];
    },
    enabled: !!selectedUserId && !!selectedPeerId,
  });

  const getUserName = (id: string) => {
    const u = allUsers.find((u: any) => u.user_id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = "";
    conversation.forEach((m) => {
      const dateKey = formatMessageDate(m.created_at);
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: dateKey, messages: [] });
      }
      groups[groups.length - 1].messages.push(m);
    });
    return groups;
  }, [conversation]);

  const isMediaImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); setSelectedPeerId(""); }}>
            <SelectTrigger><SelectValue placeholder="בחר משתמש..." /></SelectTrigger>
            <SelectContent>
              {allUsers.map((u: any) => (
                <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedUserId && peers.length > 0 && (
          <div className="w-64">
            <Select value={selectedPeerId} onValueChange={setSelectedPeerId}>
              <SelectTrigger><SelectValue placeholder="בחר שיחה עם..." /></SelectTrigger>
              <SelectContent>
                {peers.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedUserId && selectedPeerId ? (
        <div className="bg-card rounded-lg border shadow-card overflow-hidden">
          <div className="border-b px-4 py-3 bg-muted/30 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">שיחה בין {getUserName(selectedUserId)} ל-{getUserName(selectedPeerId)}</span>
            <span className="text-xs text-muted-foreground mr-auto">{conversation.length} הודעות</span>
          </div>
          <ScrollArea className="h-[500px] px-4 py-3">
            <div className="space-y-1">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-center my-3">
                    <span className="bg-muted text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full">{group.date}</span>
                  </div>
                  {group.messages.map((msg) => {
                    const isFirst = msg.sender_id === selectedUserId;
                    return (
                      <div key={msg.id} className={`flex mb-1.5 ${isFirst ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isFirst ? "bg-primary/10 text-foreground rounded-bl-md" : "bg-muted text-foreground rounded-br-md"}`}>
                          <p className="text-[10px] font-bold text-muted-foreground mb-0.5">{getUserName(msg.sender_id)}</p>
                          {msg.media_url && (
                            <div className="mb-1.5 rounded-lg overflow-hidden">
                              {isMediaImage(msg.media_url) ? (
                                <img src={msg.media_url} alt="" className="max-h-48 rounded-lg" />
                              ) : (
                                <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-primary">📎 קובץ</a>
                              )}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.body}</p>
                          <div className="flex items-center gap-1 mt-0.5 justify-end">
                            <span className="text-[10px] text-muted-foreground">{format(parseISO(msg.created_at), "HH:mm")}</span>
                            {msg.is_read ? <CheckCheck className="h-3 w-3 text-primary/60" /> : <Check className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : selectedUserId && peers.length === 0 ? (
        <div className="bg-card rounded-lg border shadow-card p-8 text-center">
          <p className="text-muted-foreground">אין שיחות למשתמש זה</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-card p-12 text-center">
          <Eye className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">בחר משתמש כדי לצפות בשיחותיו</p>
        </div>
      )}
    </div>
  );
}
