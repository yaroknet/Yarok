import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Image, Plus, CheckCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const quickChips = [
  { label: "מצא לי טופס", action: "documents" },
  { label: "מה המשימות שלי?", action: "tasks" },
  { label: "תזכורות קרובות", action: "reminders" },
  { label: "נורות אזהרה", action: "warnings" },
  { label: "צור משימה", action: "create_task" },
  { label: "צור תזכורת", action: "create_reminder" },
];

export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("אנא בחר קובץ תמונה");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי (מקסימום 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      setSelectedImage({
        base64,
        mimeType: file.type,
        preview: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
  };

  const processAIResponse = async (content: string) => {
    // Check for task creation
    const taskMatch = content.match(/\[CREATE_TASK\](.*?)\[\/CREATE_TASK\]/s);
    if (taskMatch) {
      try {
        const taskData = JSON.parse(taskMatch[1]);
        const { error } = await supabase.from("manager_tasks").insert({
          title: taskData.title,
          description: taskData.description || null,
          due_date: taskData.due_date || null,
          assigned_to: user?.id,
          assigned_by: user?.id,
          task_type: "general",
          status: "pending",
        });
        
        if (!error) {
          toast.success("המשימה נוצרה בהצלחה!");
        }
      } catch (e) {
        console.error("Error creating task:", e);
      }
    }

    // Reminder creation removed — legacy reminders table dropped in fleet rebuild.
    // Future: hook into fleet_alerts once the alerts UI ships.

    // Clean the response from the markers
    return content
      .replace(/\[CREATE_TASK\].*?\[\/CREATE_TASK\]/s, "")
      .replace(/\[CREATE_REMINDER\].*?\[\/CREATE_REMINDER\]/s, "")
      .trim();
  };

  const streamChat = useCallback(async (userMessages: Message[], action?: string, imageData?: { base64: string; mimeType: string }) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

    // Get the current session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("לא מחובר - נא להתחבר מחדש");
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ 
        messages: userMessages.map(m => ({ role: m.role, content: m.content })), 
        action,
        imageBase64: imageData?.base64,
        imageMimeType: imageData?.mimeType,
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: "שגיאה בתקשורת" }));
      throw new Error(errorData.error || "שגיאה בתקשורת עם העוזר");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const cleanedContent = await processAIResponse(assistantSoFar);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanedContent } : m));
              }
              return [...prev, { role: "assistant", content: cleanedContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const cleanedContent = await processAIResponse(assistantSoFar);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanedContent } : m));
              }
              return [...prev, { role: "assistant", content: cleanedContent }];
            });
          }
        } catch { /* ignore */ }
      }
    }

    // Process final response for actions
    await processAIResponse(assistantSoFar);
  }, [user?.id]);

  const handleSend = async (customMessage?: string, action?: string) => {
    const messageText = customMessage || input;
    if (!messageText.trim() && !action && !selectedImage) return;

    const userMsg: Message = { 
      role: "user", 
      content: selectedImage 
        ? (messageText || "אנא זהה את נורת האזהרה בתמונה")
        : messageText,
      imageUrl: selectedImage?.preview
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const imageData = selectedImage ? { base64: selectedImage.base64, mimeType: selectedImage.mimeType } : undefined;
    setSelectedImage(null);

    try {
      await streamChat(newMessages, action, imageData);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `שגיאה: ${error instanceof Error ? error.message : "אירעה שגיאה"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickChip = (chip: typeof quickChips[0]) => {
    if (chip.action === "create_task") {
      handleSend("אני רוצה ליצור משימה חדשה", chip.action);
    } else if (chip.action === "create_reminder") {
      handleSend("אני רוצה ליצור תזכורת חדשה לרכב", chip.action);
    } else {
      handleSend(chip.label, chip.action);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          isOpen && "hidden"
        )}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium">עוזר ירוק</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">עוזר ירוק</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm text-center">
                  שלום! אני העוזר הירוק שלך. איך אוכל לעזור?
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickChips.map((chip) => (
                    <button
                      key={chip.action}
                      onClick={() => handleQuickChip(chip)}
                      className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-full hover:bg-accent/80 transition-colors flex items-center gap-1"
                    >
                      {chip.action === "create_task" && <Plus className="h-3 w-3" />}
                      {chip.action === "create_reminder" && <Bell className="h-3 w-3" />}
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="text-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors inline-flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    העלה תמונה לזיהוי נורת אזהרה
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "max-w-[85%] p-3 rounded-lg",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground mr-auto"
                        : "bg-muted text-foreground ml-auto"
                    )}
                  >
                    {msg.imageUrl && (
                      <img 
                        src={msg.imageUrl} 
                        alt="Uploaded" 
                        className="max-w-full h-auto rounded-md mb-2 max-h-32 object-contain"
                      />
                    )}
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 text-muted-foreground ml-auto">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">חושב...</span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Selected Image Preview */}
          {selectedImage && (
            <div className="px-4 py-2 border-t border-border bg-muted/50">
              <div className="flex items-center gap-2">
                <img 
                  src={selectedImage.preview} 
                  alt="Preview" 
                  className="h-12 w-12 object-cover rounded"
                />
                <span className="text-sm text-muted-foreground flex-1">תמונה מוכנה לשליחה</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedImage(null)}
                  className="h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Quick Chips when has messages */}
          {messages.length > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <div className="flex flex-wrap gap-1">
                {quickChips.slice(0, 4).map((chip) => (
                  <button
                    key={chip.action}
                    onClick={() => handleQuickChip(chip)}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs bg-accent text-accent-foreground rounded-full hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0"
                title="העלה תמונה"
              >
                <Image className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selectedImage ? "תאר את התמונה..." : "שאל אותי משהו..."}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || (!input.trim() && !selectedImage)}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
