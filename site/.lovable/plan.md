# תוכנית שדרוג מודול רכש – עריכה, גרסאות וביטול

**היקף:** רק `src/components/procurement/v2/**`, `src/lib/procurement/**`, וטבלאות `procurement_*`. אין לגעת במודולים אחרים.

## 1. שינויי סכימה (מיגרציה)

**טבלה חדשה `procurement_order_versions`** – שמירת snapshot לכל גרסה:
- `id`, `order_id` (FK), `version_number` (int), `snapshot` (jsonb – שורות + פרטי שילוח + סכומים), `pdf_url` (nullable), `document_type` (`original|update|cancellation`), `sent_at`, `sent_to` (jsonb array), `sent_by`, `send_status` (`pending|sent|failed`), `send_error`, `change_summary` (jsonb), `created_by`, `created_at`.

**עמודות ל־`procurement_orders`:**
- `current_version` int default 1
- `last_sent_version` int nullable
- `cancellation_reason` text, `cancelled_by`, `cancelled_at`

**עמודות ל־`procurement_order_lines`:**
- `added_by_role` (`region_manager|admin`), `added_by_user`, `last_edited_by`, `last_edited_at`

**הרחבת enum סטטוסים:** להוסיף `pending_update_send`, `update_sent`, `cancellation_pending_send`, `send_failed`, `edited_after_send`. אם הסטטוס הוא text – שינוי בקוד בלבד.

**טבלה `procurement_order_activity`** קיימת – נשתמש בה להיסטוריה עם `action_type` מורחב: `line_added`, `line_removed`, `line_updated`, `version_created`, `pdf_generated`, `email_sent`, `email_failed`, `cancelled`.

GRANTs + RLS: אדמין בלבד לכתיבה על versions; קריאה למי שרואה את ההזמנה.

## 2. שינויי UI/לוגיקה

### `OrderDetailsDialog.tsx` (רכיב מרכזי)
- **הסרת נעילת עריכה לאחר אישור** – אדמין תמיד יכול לערוך. משתמש רגיל – readonly.
- **כפתור "הוסף מוצר להזמנה"** – פותח `AddLineDialog` חדש עם Combobox: חיפוש בקטלוג פנימי + במחירוני ספקים, בחירת ספק/מק"ט/כמות/יח' במארז/מחיר/הערה. אפשרות "מוצר ידני" ללא שיוך.
- **פעולות בשורה:** מחיקה, שכפול (פיצול), החלפת מוצר, שינוי כמות/מחיר/ספק/מק"ט.
- **סימון מקור שורה:** אייקון + tooltip "נוסף ע"י מנהל אזור/אדמין" – פנימי בלבד.
- **בעת שמירה על הזמנה שכבר נשלחה (`last_sent_version` קיים):** הצגת דיאלוג אישור → יצירת snapshot של הגרסה החדשה + סטטוס `pending_update_send` + חישוב change summary מול הגרסה הקודמת.
- **פאנל "היסטוריית פעולות"** – שליפה מ־`procurement_order_activity` בסדר כרונולוגי בעברית.
- **פאנל "גרסאות ומסמכים"** – טבלת גרסאות עם צפייה/הורדה/שליחה חוזרת.

### `OrdersList.tsx`
- כפתורי פעולה לפי סטטוס: `שלח עדכון לספק`, `בטל הזמנה`, `נסה לשלוח שוב`.
- `CancelOrderDialog` חדש – סיבה חובה + אזהרה + יצירת version מסוג `cancellation`.

### רכיבים חדשים
- `AddOrderLineDialog.tsx` – Combobox אחוד לחיפוש מוצר.
- `OrderVersionsPanel.tsx` – טבלת גרסאות.
- `OrderActivityLog.tsx` – היסטוריה.
- `OrderChangeSummary.tsx` – השוואת diff לפני שליחת עדכון.
- `CancelOrderDialog.tsx`.

## 3. שכבת PDF (`src/lib/procurement/pdf.ts`)

הרחבה של המחולל הקיים (Heebo/RTL):
- פרמטר `variant`: `original | update | cancellation`.
- באנר עליון מודגש לפי variant + סוג שינוי (נוספו/הוסרו/כמויות/משולב).
- מציג מספר הזמנה + `v{n}` + תאריך עדכון + סיכום שינויים.
- PDF ביטול – פורמט נפרד עם סיבת ביטול, שם אדמין, טבלת פריטים שבוטלו, בקשת אישור קבלה.
- שם קובץ: `ORD-2026-00002_v2_{supplier}.pdf` / `ביטול_ORD-..._{supplier}.pdf`.
- העלאה ל־storage `purchase-order-attachments` ושמירת URL על גרסה.

## 4. פונקציית diff

`src/lib/procurement/diff.ts` – מקבל שתי גרסאות (snapshot), מחזיר `{added[], removed[], quantityIncreased[], quantityDecreased[], priceChanged[], supplierChanged[], skuChanged[], shippingChanged, notesChanged}` + טקסט מסוכם בעברית לתצוגה ולמייל.

## 5. שליחת מייל

שימוש בפונקציה קיימת `sendEmailsToSuppliers` – הרחבה:
- טמפלייטים לפי variant (עדכון / ביטול).
- עדכון גרסה: `send_status='sent'`, `sent_at`, `sent_to`; שינוי סטטוס להזמנה ל־`update_sent` / `cancelled`.
- בכישלון: `send_status='failed'`, סטטוס `send_failed` או `pending_update_send`/`cancellation_pending_send` – ההזמנה לא נסגרת.

## 6. הרשאות
- כל כפתורי אדמין מותנים ב־`isSuperAdmin || isManager`.
- שרת: אין שינוי ב־`procurement-form` (מנהל אזור). עדכוני אדמין דרך client עם RLS מתאים.

## 7. בדיקות ידניות
לפי סעיף 19 בדרישות – ריצה ידנית של תרחישי הוספה/עריכה/גרסה/ביטול/כשל שליחה.

## הערות למשתמש
- לא נגעתי במודולים אחרים.
- לאחר אישור התוכנית אבצע: מיגרציה → שכבת שירות (diff/pdf/versions) → UI → בדיקה.
- שליחת מייל בפועל תלויה בקיום חיבור SMTP/n8n; אם אין – יוצג "ממתין לשליחה" עם retry.
