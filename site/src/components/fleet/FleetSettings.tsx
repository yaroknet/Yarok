import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FleetImportPanel } from "./FleetImportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const DOC_TYPES = ["רישיון רכב", "ביטוח", "טסט", "חוזה ליסינג", "רישיון נהיגה", "אחר"];
const MAINT_TYPES = ["טיפול תקופתי", "טסט", "תיקון", "החלפת חלק", "צמיגים", "אחר"];
const ALERT_THRESHOLDS = [
  { k: "טסט", v: "התראה 30 יום לפני / אדום מתחת ל-14 יום" },
  { k: "ביטוח", v: "התראה 30 יום לפני / אדום מתחת ל-14 יום" },
  { k: "טיפול", v: 'התראה כאשר עברו ק"מ הטיפול פחות מ-1000 ק"מ' },
  { k: 'חריגת ק"מ', v: "אזהרה מעל 105% מהצפוי, סכנה מעל 115%" },
];

export function FleetSettings() {
  return (
    <div dir="rtl">
      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links">קישורי דיווח חיצוניים</TabsTrigger>
          <TabsTrigger value="import">ייבוא Excel</TabsTrigger>
          <TabsTrigger value="config">קונפיגורציה</TabsTrigger>
          <TabsTrigger value="n8n">התראות N8N</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="pt-4 space-y-4">
          <ExternalReportLinks />
        </TabsContent>

        <TabsContent value="import" className="pt-4">
          <FleetImportPanel />
        </TabsContent>


        <TabsContent value="config" className="pt-4 space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-2">סוגי מסמכים זמינים</h3>
            <div className="text-sm text-muted-foreground mb-2">רשימת סוגי מסמכים המשמשים במסך המסמכים.</div>
            <ul className="text-sm list-disc pr-5">{DOC_TYPES.map(t => <li key={t}>{t}</li>)}</ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-2">סוגי טיפולים</h3>
            <ul className="text-sm list-disc pr-5">{MAINT_TYPES.map(t => <li key={t}>{t}</li>)}</ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-2">ספי התראה</h3>
            <div className="text-sm space-y-1">{ALERT_THRESHOLDS.map(a => <div key={a.k}><b>{a.k}:</b> {a.v}</div>)}</div>
          </Card>
        </TabsContent>

        <TabsContent value="n8n" className="pt-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-2">התראות ל-N8N</h3>
            <p className="text-sm text-muted-foreground">
              כל התראה נשמרת בטבלת <code>fleet_alerts</code> עם <code>dedup_key</code> ייחודי המונע כפילויות.
              N8N יכול לבצע polling על שורות עם <code>status = 'pending'</code>, לעבד אותן ולעדכן ל-<code>sent</code>.
            </p>
            <div className="mt-4 text-xs bg-muted/50 rounded p-3 font-mono">
              GET /rest/v1/fleet_alerts?status=eq.pending&order=created_at.asc<br/>
              PATCH /rest/v1/fleet_alerts?id=eq.&lt;id&gt; · body: {'{'} "status": "sent", "sent_at": now() {'}'}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExternalReportLinks() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = [
    { key: "accident_report_url", title: "דיווח תאונה", desc: "טופס ציבורי לדיווח תאונה מהשטח — ללא צורך בהתחברות. פתיחה במובייל, בחירת נהג ומילוי פרטים.", url: `${origin}/fleet-report/incident`, icon: "🚨" },
    { key: "monthly_km_report_url", title: "דיווח קילומטרז׳", desc: 'טופס ציבורי לדיווח ק"מ חודשי — צילום מד ק"מ + הזנת מספר. עדכון אוטומטי של ניצול הליסינג.', url: `${origin}/fleet-report/km`, icon: "🚗" },
  ];

  const copy = async (url: string, title: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`הקישור "${title}" הועתק`);
    } catch {
      toast.error("העתקה נכשלה — סמן והעתק ידנית");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-1">קישורי דיווח חיצוניים</h3>
        <p className="text-sm text-muted-foreground">מנהלי שטח מקבלים את הקישורים ב-WhatsApp ומדווחים ישירות מהמובייל, ללא משתמש וסיסמה. הטפסים חשופים לפעולה בלבד — אין גישה לצי, לרשימות או לנתונים אחרים.</p>
      </Card>

      {links.map(l => (
        <Card key={l.key} className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{l.icon}</div>
            <div className="flex-1">
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">משתנה N8N: <code>{l.key}</code></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={l.url} className="font-mono text-xs" onClick={e => (e.target as HTMLInputElement).select()} />
            <Button variant="outline" size="sm" onClick={() => copy(l.url, l.title)}><Copy className="h-4 w-4 ml-1" />העתק</Button>
            <Button variant="outline" size="sm" asChild><a href={l.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 ml-1" />פתח</a></Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

