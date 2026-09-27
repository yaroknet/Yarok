// Helpers for the quotes module

export const MATERIAL_OPTIONS: { key: string; label: string }[] = [
  { key: "basic", label: "כולל חומרים בסיסיים" },
  { key: "none", label: "ללא חומרים" },
  { key: "toiletries", label: "טואלטיקה" },
  { key: "bags", label: "שקיות" },
  { key: "paper_towels", label: "מגבות נייר" },
  { key: "toilet_paper", label: "נייר טואלט" },
  { key: "other", label: "אחר (טקסט חופשי)" },
];

export const FREQUENCY_OPTIONS: string[] = [
  "חד פעמי",
  "יומי",
  "שבועי",
  "דו שבועי",
  "חודשי",
  "רבעוני",
  "חצי שנתי",
  "שנתי",
  "אחר",
];

export const QUOTE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "bg-muted text-muted-foreground" },
  sent: { label: "נשלח", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  viewed: { label: "נצפה", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  signed: { label: "נחתם", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  expired: { label: "פג תוקף", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  cancelled: { label: "בוטל", color: "bg-destructive/10 text-destructive" },
};

export function buildQuoteUrl(token: string): string {
  return `${window.location.origin}/quote/${token}`;
}

export function buildWhatsAppShareUrl(phone: string | null | undefined, quoteUrl: string, quoteNumber: number): string {
  const cleaned = (phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(
    `שלום, מצורפת הצעת מחיר מספר ${quoteNumber} מקבוצת ירוק.\nלצפייה ולחתימה דיגיטלית:\n${quoteUrl}`,
  );
  if (cleaned) {
    let intl = cleaned;
    if (intl.startsWith("0")) intl = "972" + intl.slice(1);
    return `https://wa.me/${intl}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

export function buildMailtoUrl(email: string | null | undefined, quoteUrl: string, quoteNumber: number): string {
  const subject = encodeURIComponent(`הצעת מחיר מספר ${quoteNumber} - קבוצת ירוק`);
  const body = encodeURIComponent(
    `שלום,\n\nמצורף קישור להצעת מחיר מספר ${quoteNumber} מקבוצת ירוק.\nלצפייה ולחתימה דיגיטלית:\n${quoteUrl}\n\nבברכה,\nקבוצת ירוק`,
  );
  return `mailto:${email || ""}?subject=${subject}&body=${body}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
