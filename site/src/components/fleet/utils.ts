export function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
}

export function statusForDays(days: number | null): "ok" | "warn" | "danger" | "expired" | "unknown" {
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days <= 14) return "danger";
  if (days <= 30) return "warn";
  return "ok";
}

export function fmtDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("he-IL");
}

export function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString("he-IL");
}

export function kmUtilization(v: {
  initial_km?: number | null;
  current_km?: number | null;
  annual_km_limit?: number | null;
  leasing_months?: number | null;
  leasing_start_date?: string | null;
}): {
  used: number;
  annualLimit: number;
  totalLimit: number;
  monthsElapsed: number;
  expectedByNow: number;
  /** actual usage in the current lease year vs annual limit (0-100+) */
  annualPct: number;
  /** total usage across whole leasing period (info only) */
  totalPct: number;
  /** expected usage % for current lease year based on days elapsed */
  expectedPct: number;
  /** current lease year km used (approx) */
  currentYearKm: number;
  /** alert level reached: 0/70/80/90/100 (only when ahead of pace) */
  alertLevel: 0 | 70 | 80 | 90 | 100;
  status: "ok" | "warn" | "danger";
} {
  const used = Math.max(0, (v.current_km ?? 0) - (v.initial_km ?? 0));
  const annualLimit = v.annual_km_limit ?? 0;
  const months = v.leasing_months ?? 36;
  const totalLimit = annualLimit * (months / 12);

  const start = v.leasing_start_date ? new Date(v.leasing_start_date) : null;
  const monthsElapsed = start
    ? Math.max(0, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
    : 0;
  const expectedByNow = (annualLimit / 12) * monthsElapsed;

  // Current lease year computation
  let currentYearKm = used;
  let daysIntoYear = 0;
  if (start && annualLimit > 0) {
    const daysSinceStart = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
    const yearIndex = Math.floor(daysSinceStart / 365);
    daysIntoYear = daysSinceStart - yearIndex * 365;
    // Approximation: assume prior full years consumed exactly the annual limit
    currentYearKm = Math.max(0, used - yearIndex * annualLimit);
  }

  const annualPct = annualLimit > 0 ? (currentYearKm / annualLimit) * 100 : 0;
  const totalPct = totalLimit > 0 ? (used / totalLimit) * 100 : 0;
  const expectedPct = annualLimit > 0 && start ? (daysIntoYear / 365) * 100 : 0;

  // Alert level only when driving faster than the pace
  let alertLevel: 0 | 70 | 80 | 90 | 100 = 0;
  const aheadOfPace = expectedPct === 0 || annualPct > expectedPct;
  if (aheadOfPace) {
    if (annualPct >= 100) alertLevel = 100;
    else if (annualPct >= 90) alertLevel = 90;
    else if (annualPct >= 80) alertLevel = 80;
    else if (annualPct >= 70) alertLevel = 70;
  }

  const status: "ok" | "warn" | "danger" =
    alertLevel >= 100 ? "danger" : alertLevel >= 70 ? "warn" : "ok";

  return { used, annualLimit, totalLimit, monthsElapsed, expectedByNow, annualPct, totalPct, expectedPct, currentYearKm, alertLevel, status };
}

