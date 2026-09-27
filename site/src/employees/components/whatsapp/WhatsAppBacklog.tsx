import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/employees/components/ui/card";
import { Checkbox } from "@/employees/components/ui/checkbox";
import { Textarea } from "@/employees/components/ui/textarea";
import { Badge } from "@/employees/components/ui/badge";
import { Button } from "@/employees/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/employees/integrations/supabase/client";

interface BacklogItem {
  id: string;
  category: string;
  description: string;
  done: boolean;
  note: string;
}

const INITIAL_ITEMS: BacklogItem[] = [
  { id: "1", category: "לוגיקה", description: "לא לשלוח תזכורות מתוזמנות למשימות בסטטוס 'בוצע' או שנמחקו/התבטלו (מלבד הודעת הביטול עצמה)", done: false, note: "" },
  { id: "2", category: "לוגיקה", description: "כל ההודעות בעברית עם RTL מלא", done: false, note: "" },
  { id: "3", category: "טריגרים", description: "שליחת הודעה מיידית בעת הזנת דבר חדש עבור מבצע — ב'משימות' או ב'ניהול שירות'", done: false, note: "" },
  { id: "4", category: "טריגרים", description: "הודעת ביטול: 'המשימה באתר X בוטלה/נמחקה. אין צורך להגיע'", done: false, note: "" },
  { id: "5", category: "טריגרים", description: "הודעת עדכון: '🔔 עדכון למשימה קיימת 🔔' עם פרטים מלאים", done: false, note: "" },
  { id: "6", category: "תזכורות", description: "משימה חד-פעמית ללא דדליין: תזכורת אחרי 14 יום, ואז כל 3 ימים עד שתסומן כבוצעה", done: false, note: "" },
  { id: "7", category: "תזכורות", description: "משימה חודשית: אם לא בוצעה עד ה-20, תזכורת כל 3 ימים עד סוף החודש. אם לא בוצעה עד סוף החודש — נכנסת לטבלת 'משימות שהתפספסו' עם התראה מרוכזת (למבצע את שלו, לדפנה קסטרו גובה, לאורית/מאיה/עוזי את של כולם, לשיינא ויטרינות בלבד — לא כולל משימות אחרות גם אם הוזנו למבצעים שהוגדרו לה). המשימה מתחדשת כל חודש אלא אם הוגדר אחרת", done: false, note: "" },
  { id: "8", category: "תזכורות", description: "משימה רבעונית: בחודש האחרון של הרבעון תזכורת שבועית. אם לא בוצעה עד סוף הרבעון — נכנסת לטבלת 'משימות שהתפספסו הרבעון' ב-1 לחודש שאחרי, עם התראה מרוכזת (למבצע את שלו, לדפנה רבעוני סופר פארם, לאורית/מאיה/עוזי את של כולם, לשיינא אוסמוזה רבעוני בלבד — לא כולל משימות אחרות גם אם הוזנו למבצעים שהוגדרו לה). המשימה מתחדשת כל רבעון אלא אם הוגדר אחרת", done: false, note: "" },
  { id: "9", category: "תזכורות", description: "תגבור/כ\"א: תזכורת יומיים לפני ויום לפני תאריך התחלה. אם לא דווח שבוצע — התראות יומיות לאורית ולמבצע (אם פרוסה על יותר מיום — תזכורת יום ביומו)", done: false, note: "" },
  { id: "10", category: "תזכורות", description: "התחלת שירות: תזכורת 7 ימים ו-2 ימים לפני. אם 'בהקדם' — כל 3 ימים. ביום ההתחלה — הודעת 'בוקר טוב! בהצלחה היום בתחילת השירות ב[שם המשימה]' ב-08:00 בבוקר", done: false, note: "" },
  { id: "11", category: "תזכורות", description: "עדכון/הפסקת שירות: תזכורת 7 ימים ויום לפני", done: false, note: "" },
  { id: "12", category: "סיכומים", description: "צחי: סיכום יומי ב-18:00 של כל המשימות הפתוחות של משתמשי מערכת (למעט אהרון)", done: false, note: "" },
  { id: "13", category: "סיכומים", description: "אורית עדן: סיכום יומי ב-18:00 — לוג בקרה של כל תזכורות היום + דו\"ח יומי זהה לזה של אילן", done: false, note: "" },
  { id: "14", category: "סיכומים", description: "אילן: יומי ב-18:00 — משימות שנפתחו באותו יום (משתמשי מערכת + אילן, ללא קבלנים)", done: false, note: "" },
  { id: "15", category: "סיכומים", description: "אילן: שבועי חמישי 18:00 — כל המשימות הפתוחות (משתמשי מערכת + אילן, ללא קבלנים). חשוב לציין 'לידיעה' ולשלוח בנפרד מקובץ משימות אילן+אהרון", done: false, note: "" },
  { id: "16", category: "סיכומים", description: "אהרון: שבועי חמישי 18:00 — כל המשימות הפתוחות (משתמשי מערכת + אילן, ללא קבלנים). חשוב לציין 'לידיעה' ולשלוח בנפרד מקובץ משימות אילן+אהרון", done: false, note: "" },
  { id: "17", category: "סיכומים", description: "כל הסיכומים כוללים גם משימות וגם ניהול שירות", done: false, note: "" },
  { id: "18", category: "תוכן", description: "הודעת בוקר: 'המשך יום נעים ועבודה נעימה!' — אם הודעות מתוזמנות לצהריים: 'צהריים טובים'. אם חג יהודי: 'חג שמח!'", done: false, note: "" },
  { id: "19", category: "תוכן", description: "הודעת ערב: 'תודה והמשך ערב נעים!'", done: false, note: "" },
  { id: "20", category: "תוכן", description: "הפסקת שירות: כולל תזכורת לאיסוף חומרים, משולש אזהרה, שואבים וציוד", done: false, note: "" },
  { id: "21", category: "תוכן", description: "כל תזכורת כוללת: סוג עבודה, לקוח, סניף, היקף, תדירות, דדליין, תאריכים (במידה ויש), הערות", done: false, note: "" },
  { id: "22", category: "תוכן", description: "אין משימות להיום — הודעה ב-18:00 רק לאילן, צחי, אהרון ואורית: 'ערב טוב [שם], אין משימות להיום' (במידה ולא הוזנו משימות או ניהול שירות באותו יום)", done: false, note: "" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "לוגיקה": "bg-blue-100 text-blue-800",
  "טריגרים": "bg-purple-100 text-purple-800",
  "תזכורות": "bg-orange-100 text-orange-800",
  "סיכומים": "bg-green-100 text-green-800",
  "תוכן": "bg-pink-100 text-pink-800",
};

export function WhatsAppBacklog() {
  const [items, setItems] = useState<BacklogItem[]>(INITIAL_ITEMS);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from DB on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("whatsapp_backlog")
        .select("id, done, note");
      
      if (data && data.length > 0) {
        const dbMap = new Map(data.map((r: any) => [r.id, r]));
        setItems(INITIAL_ITEMS.map((item) => {
          const saved = dbMap.get(item.id);
          return saved ? { ...item, done: saved.done, note: saved.note || "" } : item;
        }));
      }
      setLoaded(true);
    })();
  }, []);

  const upsertItem = useCallback(async (id: string, done: boolean, note: string) => {
    await supabase
      .from("whatsapp_backlog")
      .upsert({ id, done, note, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }, []);

  const toggle = (id: string) => {
    const updated = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    setItems(updated);
    const item = updated.find((i) => i.id === id)!;
    upsertItem(id, item.done, item.note);
  };

  const updateNote = (id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  };

  const saveNote = (id: string) => {
    setEditingNote(null);
    const item = items.find((i) => i.id === id);
    if (item) {
      upsertItem(id, item.done, item.note);
      toast.success("ההערה נשמרה");
    }
  };

  const markAll = async (done: boolean) => {
    const updated = items.map((i) => ({ ...i, done }));
    setItems(updated);
    await Promise.all(updated.map((i) => upsertItem(i.id, i.done, i.note)));
    toast.success(done ? "כל הפריטים סומנו כבוצעו" : "כל הסימונים אופסו");
  };

  const doneCount = items.filter((i) => i.done).length;
  const categories = [...new Set(INITIAL_ITEMS.map((i) => i.category))];

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">בקשות WhatsApp — מעקב ביצוע</CardTitle>
        <Badge variant="secondary">{doneCount}/{items.length} בוצעו</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[cat] || ""}`}>{cat}</span>
            </h3>
            <div className="space-y-1.5">
              {items
                .filter((i) => i.category === cat)
                .map((item) => (
                  <div key={item.id} className={`flex items-start gap-2 p-2 rounded border ${item.done ? "bg-muted/50 border-muted" : "border-border"}`}>
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`text-sm leading-relaxed ${item.done ? "line-through text-muted-foreground" : ""}`}>
                        {item.description}
                      </p>
                      {editingNote === item.id ? (
                        <Textarea
                          value={item.note}
                          onChange={(e) => updateNote(item.id, e.target.value)}
                          onBlur={() => saveNote(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveNote(item.id);
                            }
                          }}
                          placeholder="הערה / שינוי נדרש..."
                          className="text-xs min-h-[60px]"
                          dir="rtl"
                          autoFocus
                        />
                      ) : item.note ? (
                        <p
                          className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded cursor-pointer hover:bg-muted"
                          onClick={() => setEditingNote(item.id)}
                        >
                          📝 {item.note}
                        </p>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingNote(item.id)}
                        >
                          + הוסף הערה
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => markAll(true)}>
            סמן הכל כבוצע
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll(false)}>
            אפס הכל
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
