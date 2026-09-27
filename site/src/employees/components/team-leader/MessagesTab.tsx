import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/employees/integrations/supabase/client";
import { useAuth } from "@/employees/contexts/AuthContext";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { ScrollArea } from "@/employees/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/employees/components/ui/avatar";
import {
  Send, ArrowRight, Check, CheckCheck, MessageSquare,
  Search, Paperclip, Image as ImageIcon
} from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

interface Contact {
  user_id: string;
  full_name: string | null;
  email: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
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

function formatMessageDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "היום";
  if (isYesterday(date)) return "אתמול";
  return format(date, "dd/MM/yyyy");
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

interface MessagesTabProps {
  variant?: "mobile" | "desktop";
}

export function MessagesTab({ variant = "mobile" }: MessagesTabProps) {
  const { user, isAdmin, roles } = useAuth();
  const isContractorWorker = roles.includes("contractor_worker");
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Fetch contractor link for contractor_worker
  const { data: contractorLink } = useQuery({
    queryKey: ["my-contractor-link", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("contractor_workers")
        .select("contractor_id")
        .eq("worker_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isContractorWorker,
  });

  // Fetch available contacts based on role
  const { data: contacts = [] } = useQuery({
    queryKey: ["chat-contacts", user?.id, contractorLink?.contractor_id],
    queryFn: async () => {
      if (!user) return [];

      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      // Get user roles to determine who's an admin
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map<string, string[]>();
      (userRoles || []).forEach((r: any) => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      });

      // Get all messages for this user
      const { data: messages } = await supabase
        .from("internal_messages")
        .select("*")
        .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      // Filter contacts based on role
      const isCurrentUserAdmin = isAdmin;
      let availableContacts = (profiles || []).filter((p: any) => {
        if (p.user_id === user.id) return false;
        if (isCurrentUserAdmin) return true;
        // Contractor workers can only chat with their contractor
        if (isContractorWorker) {
          return p.user_id === contractorLink?.contractor_id;
        }
        // Non-admins can only chat with admins
        const contactRoles = roleMap.get(p.user_id) || [];
        return contactRoles.includes("super_admin") || contactRoles.includes("office_manager");
      });

      // Build contact list with last message info
      const contactList: Contact[] = availableContacts.map((p: any) => {
        const userMessages = (messages || []).filter(
          (m: any) =>
            (m.sender_id === p.user_id && m.recipient_id === user.id) ||
            (m.sender_id === user.id && m.recipient_id === p.user_id)
        );
        const lastMsg = userMessages[0];
        const unread = userMessages.filter(
          (m: any) => m.sender_id === p.user_id && !m.is_read
        ).length;

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          lastMessage: lastMsg?.body,
          lastMessageTime: lastMsg?.created_at,
          unreadCount: unread,
        };
      });

      // Sort: contacts with messages first (by recency), then alphabetically
      return contactList.sort((a, b) => {
        if (a.lastMessageTime && !b.lastMessageTime) return -1;
        if (!a.lastMessageTime && b.lastMessageTime) return 1;
        if (a.lastMessageTime && b.lastMessageTime) {
          return b.lastMessageTime.localeCompare(a.lastMessageTime);
        }
        return (a.full_name || "").localeCompare(b.full_name || "");
      });
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Fetch messages for selected contact
  const { data: chatMessages = [] } = useQuery({
    queryKey: ["chat-messages", user?.id, selectedContact?.user_id],
    queryFn: async () => {
      if (!user || !selectedContact) return [];
      const { data, error } = await supabase
        .from("internal_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${selectedContact.user_id}),and(sender_id.eq.${selectedContact.user_id},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!user && !!selectedContact,
    refetchInterval: 3000,
  });

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!user || !selectedContact || chatMessages.length === 0) return;
    const unread = chatMessages.filter(
      (m) => m.sender_id === selectedContact.user_id && !m.is_read
    );
    if (unread.length > 0) {
      supabase
        .from("internal_messages")
        .update({ is_read: true })
        .in("id", unread.map((m) => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
          queryClient.invalidateQueries({ queryKey: ["unread-messages-count"] });
        });
    }
  }, [chatMessages, selectedContact, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if ((!messageText.trim() && !mediaFile) || !user || !selectedContact) return;
    setSending(true);
    try {
      let mediaUrl: string | null = null;
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("message-media").upload(path, mediaFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("message-media").getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("internal_messages").insert({
        sender_id: user.id,
        recipient_id: selectedContact.user_id,
        body: messageText.trim() || (mediaFile ? "📎 קובץ מצורף" : ""),
        media_url: mediaUrl,
      });
      if (error) throw error;
      setMessageText("");
      setMediaFile(null);
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages-count"] });
    } catch {
      toast.error("שגיאה בשליחת ההודעה");
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = "";
    chatMessages.forEach((m) => {
      const dateKey = formatMessageDate(m.created_at);
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: dateKey, messages: [] });
      }
      groups[groups.length - 1].messages.push(m);
    });
    return groups;
  }, [chatMessages]);

  const isMediaImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  // ─── Desktop split-view ───
  if (variant === "desktop") {
    return (
      <div className="flex h-[calc(100vh-14rem)] bg-card rounded-lg border shadow-card overflow-hidden" dir="rtl">
        {/* Contacts sidebar */}
        <div className={`${selectedContact ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-l`}>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="חפש איש קשר..." className="pr-10 rounded-xl h-10" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredContacts.map((c) => (
              <button
                key={c.user_id}
                onClick={() => setSelectedContact(c)}
                className={`w-full text-right flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 ${selectedContact?.user_id === c.user_id ? "bg-muted" : ""}`}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{getInitials(c.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{c.full_name || c.email}</span>
                    {c.lastMessageTime && <span className="text-[10px] text-muted-foreground shrink-0">{formatMessageDate(c.lastMessageTime)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "לחץ להתחלת שיחה"}</p>
                    {c.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">{c.unreadCount}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-col flex-1`}>
          {selectedContact ? (
            <>
              <div className="border-b px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedContact(null)}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{getInitials(selectedContact.full_name)}</AvatarFallback>
                </Avatar>
                <span className="font-bold text-sm">{selectedContact.full_name || selectedContact.email}</span>
              </div>
              {renderChatArea()}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">בחר איש קשר להתחלת שיחה</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Mobile: contact list view ───
  if (!selectedContact) {
    return (
      <div className="px-4 pb-24 space-y-3" dir="rtl">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">שיחות</h2>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="חפש איש קשר..." className="pr-10 rounded-xl h-11" />
        </div>
        {filteredContacts.length === 0 ? (
          <div className="bg-card rounded-2xl border shadow-card p-8 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">אין אנשי קשר זמינים</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <button key={contact.user_id} onClick={() => setSelectedContact(contact)} className="w-full text-right">
              <div className="bg-card rounded-xl border shadow-card p-3 flex items-center gap-3 hover:shadow-elevated transition-all">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{getInitials(contact.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{contact.full_name || contact.email || "משתמש"}</span>
                    {contact.lastMessageTime && <span className="text-[11px] text-muted-foreground shrink-0">{formatMessageDate(contact.lastMessageTime)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{contact.lastMessage || "לחץ להתחלת שיחה"}</p>
                    {contact.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0">{contact.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    );
  }

  // ─── Mobile: chat view ───
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]" dir="rtl">
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedContact(null)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{getInitials(selectedContact.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-foreground truncate">{selectedContact.full_name || selectedContact.email || "משתמש"}</h3>
          <p className="text-[11px] text-muted-foreground">לחץ לחזור לרשימה</p>
        </div>
      </div>
      {renderChatArea()}
    </div>
  );

  // ─── Shared chat area renderer ───
  function renderChatArea() {
    return (
      <>
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-1">
            {groupedMessages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">התחל שיחה חדשה</p>
              </div>
            )}
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center my-3">
                  <span className="bg-muted text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full">{group.date}</span>
                </div>
                {group.messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex mb-1.5 ${isMine ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isMine ? "bg-primary text-primary-foreground rounded-bl-md" : "bg-muted text-foreground rounded-br-md"}`}>
                        {msg.media_url && (
                          <div className="mb-1.5 rounded-lg overflow-hidden">
                            {isMediaImage(msg.media_url) ? (
                              <img src={msg.media_url} alt="" className="max-h-48 rounded-lg cursor-pointer" onClick={() => window.open(msg.media_url!, "_blank")} />
                            ) : (
                              <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={`text-xs underline ${isMine ? "text-primary-foreground/80" : "text-primary"}`}>📎 פתח קובץ</a>
                            )}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.body}</p>
                        <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-start" : "justify-end"}`}>
                          <span className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{format(parseISO(msg.created_at), "HH:mm")}</span>
                          {isMine && (msg.is_read ? <CheckCheck className="h-3 w-3 text-primary-foreground/60" /> : <Check className="h-3 w-3 text-primary-foreground/60" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        {mediaFile && (
          <div className="px-4 py-2 bg-muted/50 border-t flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{mediaFile.name}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setMediaFile(null)}>✕</Button>
          </div>
        )}
        <div className="bg-card border-t px-3 py-2.5 flex items-center gap-2">
          <input type="file" ref={fileRef} className="hidden" accept="image/*,video/*" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="כתוב הודעה..."
            className="rounded-full h-10 flex-1"
          />
          <Button size="icon" className="shrink-0 h-9 w-9 rounded-full" disabled={(!messageText.trim() && !mediaFile) || sending} onClick={sendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }
}
