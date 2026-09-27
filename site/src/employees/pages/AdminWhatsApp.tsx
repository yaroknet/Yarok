import { useState } from "react";
import { AdminLayout } from "@/employees/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/employees/components/ui/tabs";
import { CalendarClock, FileText, History, Send } from "lucide-react";
import { WhatsAppSchedules } from "@/employees/components/whatsapp/WhatsAppSchedules";
import { CustomReminders } from "@/employees/components/whatsapp/CustomReminders";
import { WhatsAppTemplates } from "@/employees/components/whatsapp/WhatsAppTemplates";
import { WhatsAppLog } from "@/employees/components/whatsapp/WhatsAppLog";
import { WhatsAppManualSend } from "@/employees/components/whatsapp/WhatsAppManualSend";

export default function AdminWhatsApp() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול הודעות וואטסאפ</h1>
          <p className="text-muted-foreground text-sm mt-1">סיכומים מתוזמנים, תבניות הודעות, לוג ושליחה ידנית</p>
        </div>

        <Tabs defaultValue="schedules" dir="rtl">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="schedules" className="gap-1.5">
              <CalendarClock className="h-4 w-4" />
              <span className="hidden sm:inline">תזמונים</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">תבניות</span>
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">לוג הודעות</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-1.5">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">שליחה ידנית</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-8">
            <WhatsAppSchedules />
            <div className="border-t border-border/60 pt-6">
              <CustomReminders />
            </div>
          </TabsContent>
          <TabsContent value="templates">
            <WhatsAppTemplates />
          </TabsContent>
          <TabsContent value="log">
            <WhatsAppLog />
          </TabsContent>
          <TabsContent value="send">
            <WhatsAppManualSend />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
