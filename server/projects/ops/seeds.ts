import type { Seed } from "../context.ts";

/** Rows the original database seeded. Each seed is applied once. */
export const seeds: Seed[] = [
  {
    id: "20260413112043_shaina_vitrines_schedule",
    table: "whatsapp_schedule_config",
    rows: [
      {
        name: "סיכום דו-שבועי וטרינות — שיינא",
        description: "שליחת סטטוס וטרינות חדשות, שהופסקו או שעודכן בהן התקן — אחת לשבועיים",
        recipient_name: "שיינא צור",
        recipient_phone: "0505621149",
        schedule_type: "biweekly",
        schedule_time: "10:00",
        schedule_day: 0,
        summary_type: "vitrines",
        is_active: true,
      },
    ],
  },
  {
    id: "20260428080712_custom_reminders",
    table: "custom_reminders",
    upsertOn: "reminder_key",
    rows: [
      {
        reminder_key: "pini_castro_superpharm",
        name: "תזכורת חודשית לפיני - קסטרו וסופר פארם",
        description: "תזכורת ב-14 וב-28 לכל חודש למלא את הטבלה",
        recipient_name: "פיני",
        recipient_phone: "0548944555",
        schedule_type: "monthly_dates",
        month_days: [14, 28],
        schedule_time: "17:00",
        pre_saturday_friday: true,
        pre_saturday_time: "08:00",
        message_body: "נא למלא את הטבלה של *קסטרו* ו-*סופר פארם*.",
        link_url:
          "https://docs.google.com/spreadsheets/d/1BOtLrAfBeY0L3MbuR28jhLoaoT6wXTJO/edit?gid=780937665#gid=780937665",
        is_active: true,
      },
      {
        reminder_key: "dafna_alignment",
        name: "תזכורת חודשית לדפנה - יישור קו",
        description:
          "יום חמישי השלישי לחודש: יישור קו בטבלאות סופר פארם (רבעוני) וקסטרו (חודשי), עדכון מאיה בכל בעיה",
        recipient_name: "דפנה",
        recipient_phone: "0587988352",
        schedule_type: "nth_weekday",
        weekday: 4,
        weekday_occurrence: 3,
        schedule_time: "09:00",
        message_body:
          "יישור קו חודשי:\n1️⃣ לעשות *יישור קו* בטבלת הניקיונות *הרבעוניים* של סופר פארם.\n2️⃣ לעשות *יישור קו* בטבלת הניקיונות *החודשיים* של קסטרו.\n3️⃣ לעדכן את *מאיה* בכל בעיה.",
        link_url:
          "https://docs.google.com/spreadsheets/d/1BOtLrAfBeY0L3MbuR28jhLoaoT6wXTJO/edit?gid=780937665#gid=780937665",
        is_active: true,
      },
    ],
  },
];
