import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft, ArrowRight, ClipboardCheck, Loader2 } from "lucide-react";
import {
  SUPER_PHARM_BRANCHES,
  AREA_CLEANING_ITEMS,
  EQUIPMENT_ITEMS,
  SATISFACTION_QUESTIONS,
  AREA_SCALE_LEGEND,
  SATISFACTION_SCALE_LEGEND,
} from "@/lib/superPharmBranches";
import { BranchCombobox } from "@/components/audits/BranchCombobox";
import { RatingPills } from "@/components/audits/RatingPills";
import { SignaturePad } from "@/components/audits/SignaturePad";
import { cn } from "@/lib/utils";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const PUBLIC_AUDIT_BRANCH_FALLBACK: string[] = [
  "סופר פארם בילו סנטר",
  "סופר פארם הנשיא רחובות",
  "סופר פארם רחובות הרצל",
  "סופר פארם רחובות קפרא",
  "סופר פארם רחובות שער העיר",
  "סופר פארם מזכרת בתיה",
  "סופר פארם וייצמן חולון",
  "סופר פארם איכילוב תל אביב",
  "סופר פארם רמת גן אורדע",
  "סופר פארם רמת גן ביאליק",
  "סופר פארם תל אביב מרכזית",
  "סופר פארם תל אביב עזריאלי",
  "סופר פארם תל אביב שינקין",
  "סופר פארם אור יהודה",
  "סופר פארם תל השומר",
  "סופר פארם גני תקווה",
  "סופר פארם כפר סבא ויצמן",
  "סופר פארם כפר סבא ערים",
  "סופר פארם מרכז מול רעננה",
  "סופר פארם רעננה אחוזה",
  "סופר פארם גבעת שאול",
  "סופר פארם נעימי בית שמש",
  "סופר פארם פסגת זאב",
  "סופר פארם קריית יובל ירושלים",
  "סופר פארם קריית ביאליק",
  "סופר פארם יבנה G",
  "סופר פארם אשקלון אגמים",
  "סופר פארם אשקלון גלובוס",
  "סופר פארם אשקלון חוצות",
  "סופר פארם קסטינה",
  "סופר פארם מעלה אדומים",
];

const PUBLIC_AUDIT_BRANCHES = Array.from(new Set([...PUBLIC_AUDIT_BRANCH_FALLBACK, ...SUPER_PHARM_BRANCHES]));

const createPublicAuditClient = () => {
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "yarok-public-audit-anon",
    },
  });
};

const publicAuditClient = createPublicAuditClient();

const nowLocalDatetime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const PublicAuditForm = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [branchOptions, setBranchOptions] = useState<string[]>(PUBLIC_AUDIT_BRANCHES);

  // Page 1
  const [areaManagerName, setAreaManagerName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [auditDate, setAuditDate] = useState(nowLocalDatetime());
  const [cleanerName, setCleanerName] = useState("");
  const [areaRatings, setAreaRatings] = useState<Record<string, "clean" | "not_clean">>({});
  const [areaIssueNotes, setAreaIssueNotes] = useState<Record<string, string>>({});
  const [equipment, setEquipment] = useState<Record<string, "good" | "bad" | null>>({});
  const [equipmentIssueNotes, setEquipmentIssueNotes] = useState<Record<string, string>>({});
  const [areaNotes, setAreaNotes] = useState("");

  // Page 2
  const [branchManagerName, setBranchManagerName] = useState("");
  const [branchManagerRole, setBranchManagerRole] = useState("");
  const [satisfaction, setSatisfaction] = useState<Record<string, number>>({});
  const [customerNotes, setCustomerNotes] = useState("");
  const [branchSig, setBranchSig] = useState<string | null>(null);
  const [managerSig, setManagerSig] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPublicBranches = async () => {
      if (!publicAuditClient) return;

      const { data, error } = await publicAuditClient
        .from("branches")
        .select("name")
        .order("name", { ascending: true });

      if (!mounted || error || !data?.length) return;

      const fetchedNames = data.map((branch) => branch.name).filter(Boolean);
      if (fetchedNames.length > 0) {
        setBranchOptions(Array.from(new Set([...PUBLIC_AUDIT_BRANCHES, ...fetchedNames])));
      }
    };

    loadPublicBranches();

    return () => {
      mounted = false;
    };
  }, []);

  const page1Valid = useMemo(() => {
    if (!areaManagerName.trim() || !branchName || !auditDate) return false;
    if (AREA_CLEANING_ITEMS.some((i) => !areaRatings[i.key])) return false;
    if (EQUIPMENT_ITEMS.some((i) => !equipment[i.key])) return false;
    return true;
  }, [areaManagerName, branchName, auditDate, areaRatings, equipment]);

  const page2Valid = useMemo(() => {
    if (!branchManagerName.trim() || !branchManagerRole.trim()) return false;
    if (SATISFACTION_QUESTIONS.some((q) => !satisfaction[q.key])) return false;
    if (!branchSig || !managerSig) return false;
    return true;
  }, [branchManagerName, branchManagerRole, satisfaction, branchSig, managerSig]);

  const goNext = () => {
    if (!page1Valid) {
      toast.error("יש למלא את כל השדות בעמוד 1");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!page2Valid) {
      toast.error("יש למלא את כל השדות ולחתום");
      return;
    }
    setSubmitting(true);
    try {
      if (!publicAuditClient) {
        throw new Error("חיבור הטופס הציבורי אינו זמין כרגע");
      }

      const areaVals = Object.values(areaRatings);
      const cleanCount = areaVals.filter((v) => v === "clean").length;
      const avgArea = areaVals.length ? (cleanCount / areaVals.length) * 5 : 0;
      const avgSat =
        Object.values(satisfaction).reduce((s, v) => s + v, 0) / Object.values(satisfaction).length;

      const issueNotes: Record<string, string> = {};
      Object.entries(areaIssueNotes).forEach(([k, v]) => {
        if (areaRatings[k] === "not_clean" && v.trim()) issueNotes[k] = v.trim();
      });

      const { error } = await publicAuditClient.from("area_manager_audits").insert({
        audit_date: new Date(auditDate).toISOString(),
        area_manager_name: areaManagerName.trim(),
        branch_name: branchName,
        cleaner_name: cleanerName.trim() || null,
        area_ratings: { ...areaRatings, _notes: issueNotes },
        equipment_status: equipment,
        area_manager_notes: areaNotes.trim() || null,
        branch_manager_name: branchManagerName.trim(),
        branch_manager_role: branchManagerRole.trim(),
        satisfaction_ratings: satisfaction,
        customer_notes: customerNotes.trim() || null,
        branch_manager_signature: branchSig,
        area_manager_signature: managerSig,
        average_area_score: Number(avgArea.toFixed(2)),
        average_satisfaction_score: Number(avgSat.toFixed(2)),
        submitted_by: null,
      });
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      console.error(e);
      toast.error("שגיאה בשליחת הביקורת: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-background/40 flex items-center justify-center px-4 py-10">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">הביקורת נשלחה בהצלחה</h1>
            <p className="text-muted-foreground">תודה על השליחה. הנתונים נקלטו במערכת.</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              שליחת ביקורת נוספת
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background/40 py-6 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">ביקורת מנהל אזור</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {step === 1 ? "בקרת מנהל אזור" : "סקר שביעות רצון לקוח"}
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className={cn("px-3 py-1 rounded-full", step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              1. בדיקה פיזית ומלאי
            </span>
            <span className={cn("px-3 py-1 rounded-full", step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              2. שביעות רצון לקוח
            </span>
          </div>
        </div>

        {step === 1 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">פרטים כלליים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>שם מנהל/ת האזור *</Label>
                  <Input
                    value={areaManagerName}
                    onChange={(e) => setAreaManagerName(e.target.value)}
                    className="h-12"
                    placeholder="שם מלא"
                  />
                </div>
                <div className="space-y-2">
                  <Label>שם סניף סופר-פארם *</Label>
                  <BranchCombobox branches={branchOptions} value={branchName} onChange={setBranchName} />
                </div>
                <div className="space-y-2">
                  <Label>תאריך ושעת הביקור *</Label>
                  <Input
                    type="datetime-local"
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>שם עובד/ת הניקיון במשמרת</Label>
                  <Input
                    value={cleanerName}
                    onChange={(e) => setCleanerName(e.target.value)}
                    className="h-12"
                    placeholder="שם העובד/ת"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">בדיקת ניקיון לפי אזור</CardTitle>
                <p className="text-xs text-muted-foreground">{AREA_SCALE_LEGEND}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {AREA_CLEANING_ITEMS.map((item, i) => (
                  <div key={item.key} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <Label className="text-sm leading-relaxed">
                      {i + 1}. {item.label} *
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={areaRatings[item.key] === "clean" ? "default" : "outline"}
                        onClick={() => setAreaRatings((p) => ({ ...p, [item.key]: "clean" }))}
                        className="h-12"
                      >
                        נקי
                      </Button>
                      <Button
                        type="button"
                        variant={areaRatings[item.key] === "not_clean" ? "destructive" : "outline"}
                        onClick={() => setAreaRatings((p) => ({ ...p, [item.key]: "not_clean" }))}
                        className="h-12 whitespace-normal text-xs sm:text-sm"
                      >
                        לא נקי (הועבר לביצוע העובד)
                      </Button>
                    </div>
                    {areaRatings[item.key] === "not_clean" && (
                      <div className="space-y-1 pt-1">
                        <Label className="text-xs text-muted-foreground">מה לא נקי? (הערה)</Label>
                        <Textarea
                          value={areaIssueNotes[item.key] || ""}
                          onChange={(e) =>
                            setAreaIssueNotes((p) => ({ ...p, [item.key]: e.target.value }))
                          }
                          placeholder="פרט/י מה נמצא לא נקי באזור זה"
                          className="min-h-[70px]"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">בדיקת ציוד ומלאי</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {EQUIPMENT_ITEMS.map((item) => (
                  <div key={item.key} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <Label className="text-sm leading-relaxed">{item.label} *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={equipment[item.key] === "good" ? "default" : "outline"}
                        onClick={() => setEquipment((p) => ({ ...p, [item.key]: "good" }))}
                        className="h-12"
                      >
                        {item.goodLabel}
                      </Button>
                      <Button
                        type="button"
                        variant={equipment[item.key] === "bad" ? "destructive" : "outline"}
                        onClick={() => setEquipment((p) => ({ ...p, [item.key]: "bad" }))}
                        className="h-12"
                      >
                        {item.badLabel}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הערות מנהל האזור</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={areaNotes}
                  onChange={(e) => setAreaNotes(e.target.value)}
                  rows={4}
                  placeholder="הערות נוספות..."
                />
              </CardContent>
            </Card>

            <Button onClick={goNext} className="w-full h-14 text-base gap-2">
              המשך לעמוד 2
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">פרטי נציג הסניף</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>שם מנהל/ת הסניף (או נציג/ה מטעמם) *</Label>
                  <Input
                    value={branchManagerName}
                    onChange={(e) => setBranchManagerName(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>תפקיד בסניף *</Label>
                  <Input
                    value={branchManagerRole}
                    onChange={(e) => setBranchManagerRole(e.target.value)}
                    className="h-12"
                    placeholder="למשל: מנהל סניף, סגן מנהל..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">שביעות רצון</CardTitle>
                <p className="text-xs text-muted-foreground">{SATISFACTION_SCALE_LEGEND}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {SATISFACTION_QUESTIONS.map((q, i) => (
                  <div key={q.key} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <Label className="text-sm leading-relaxed">
                      {i + 1}. {q.label} *
                    </Label>
                    <RatingPills
                      name={q.label}
                      value={satisfaction[q.key] ?? null}
                      onChange={(n) => setSatisfaction((p) => ({ ...p, [q.key]: n }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הערות ובקשות מיוחדות מהלקוח</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={4}
                  placeholder="הערות..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">חתימות דיגיטליות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SignaturePad label="חתימת מנהל/ת הסניף *" value={branchSig} onChange={setBranchSig} />
                <SignaturePad label="חתימת מנהל האזור *" value={managerSig} onChange={setManagerSig} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-14 gap-2"
              >
                <ArrowRight className="h-5 w-5" />
                חזרה
              </Button>
              <Button onClick={submit} disabled={submitting} className="h-14 gap-2">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                שליחת ביקורת
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicAuditForm;
