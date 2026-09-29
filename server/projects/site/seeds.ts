import type { Seed } from "../context.ts";

/**
 * Rows the original site database seeded, with its later updates already applied.
 * The original database only seeded three portal modules; the rest were added directly in the
 * live database, so they are reconstructed here from the app's routes (field_journal disabled
 * and payroll renamed, as the original schema history did).
 */
export const seeds: Seed[] = [
  {
    id: "site_system_settings",
    table: "system_settings",
    upsertOn: "setting_key",
    rows: [
      {
        setting_key: "reminder_warning_days",
        setting_value: { test: 30, insurance: 30, license: 30, maintenance: 14 },
        description: "Days before due date to show warning",
      },
      { setting_key: "reminder_warning_km", setting_value: { maintenance: 500 }, description: "KM before due to show warning" },
      { setting_key: "fillout_form_101_url", setting_value: "" },
      { setting_key: "fillout_employee_kit_url", setting_value: "" },
      { setting_key: "fillout_foreign_employee_kit_url", setting_value: "" },
    ],
  },
  {
    id: "site_notification_settings",
    table: "system_settings",
    upsertOn: "setting_key",
    rows: [
      {
        setting_key: "machines_notification_emails",
        setting_value: "office@yaroknet.co.il, rotem@yaroknet.co.il",
        description: "נמעני מייל להוספת מכונה ושינוי סטטוס",
      },
    ],
  },
  {
    id: "site_modules",
    table: "modules",
    upsertOn: "name",
    rows: [
      {
        name: "fleet_management",
        display_name: "ניהול צי רכב",
        description: "ניהול רכבים, נהגים, מסמכים ותחזוקה",
        icon: "Car",
        route: "/fleet",
        is_active: true,
        sort_order: 1,
      },
      { name: "crm", display_name: "קשרי לקוחות", icon: "Users", route: "/crm", is_active: true, sort_order: 10 },
      { name: "proposals", display_name: "הצעות מחיר", icon: "FileText", route: "/proposals", is_active: true, sort_order: 15 },
      { name: "procurement", display_name: "רכש", icon: "ShoppingCart", route: "/procurement", is_active: true, sort_order: 20 },
      { name: "logistics", display_name: "לוגיסטיקה", icon: "Package", route: "/logistics", is_active: true, sort_order: 30 },
      { name: "field_journal", display_name: "יומן שטח", icon: "ClipboardList", route: "/field-journal", is_active: false, sort_order: 40 },
      { name: "payroll", display_name: "ניהול עובדים", icon: "Wallet", route: "/payroll", is_active: true, sort_order: 50 },
      {
        name: "machines",
        display_name: "מעקב מכונות",
        description: "מעקב מכונות שטיפה, שואבים ותיקונים",
        icon: "Wrench",
        route: "/machines",
        is_active: true,
        sort_order: 70,
      },
    ],
  },
  {
    id: "site_survey_templates",
    table: "survey_templates",
    rows: [{ name: "סקר שביעות רצון למנהלי חנויות", description: "סקר שביעות רצון סטנדרטי למנהלי חנויות" }],
  },
  {
    id: "site_external_sync_state",
    table: "external_sync_state",
    upsertOn: "table_name",
    rows: [{ table_name: "clients" }, { table_name: "proposals" }, { table_name: "contact_inquiries" }, { table_name: "complaints" }],
  },
];
