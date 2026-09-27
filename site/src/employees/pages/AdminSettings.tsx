import { AdminLayout } from "@/employees/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/employees/components/ui/tabs";
import { useAuth } from "@/employees/contexts/AuthContext";
import { Settings, MessageCircle } from "lucide-react";
import { WhatsAppSchedules } from "@/employees/components/whatsapp/WhatsAppSchedules";
import { WhatsAppTemplates } from "@/employees/components/whatsapp/WhatsAppTemplates";
import { WhatsAppLog } from "@/employees/components/whatsapp/WhatsAppLog";
import { WhatsAppManualSend } from "@/employees/components/whatsapp/WhatsAppManualSend";
import { WhatsAppBacklog } from "@/employees/components/whatsapp/WhatsAppBacklog";
import { CalendarClock, FileText, History, Send, ClipboardCheck } from "lucide-react";
import { Tabs as InnerTabs, TabsContent as InnerTabsContent, TabsList as InnerTabsList, TabsTrigger as InnerTabsTrigger } from "@/employees/components/ui/tabs";

export default function AdminSettings() {
  const { user } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
          <p className="text-muted-foreground text-sm mt-1">הגדרות מערכת וחשבון</p>
        </div>

        <Tabs defaultValue="general" dir="rtl">
          <TabsList>
            <TabsTrigger value="general" className="gap-1.5">
              <Settings className="h-4 w-4" />
              כללי
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>פרטי חשבון</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">אימייל: </span>{user?.email}</p>
                <p className="text-sm"><span className="text-muted-foreground">מזהה: </span>{user?.id?.slice(0, 8)}...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <div className="space-y-4">
              <Tabs defaultValue="schedules" dir="rtl">
                <TabsList className="grid grid-cols-5 w-full max-w-2xl">
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
                   <TabsTrigger value="backlog" className="gap-1.5">
                     <ClipboardCheck className="h-4 w-4" />
                     <span className="hidden sm:inline">מעקב בקשות</span>
                   </TabsTrigger>
                 </TabsList>

                <TabsContent value="schedules">
                  <WhatsAppSchedules />
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
                 <TabsContent value="backlog">
                   <WhatsAppBacklog />
                 </TabsContent>
               </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
