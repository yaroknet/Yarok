export const HEADER_TO_FIELD: Record<string, string> = {
  "רשת": "network_name",
  "סניף": "branch_name",
  "גורם מבצע": "executor",
  "מבצע": "executor",
  "עיר": "branch_city",
  "כתובת": "branch_address",
  "סוג עבודה": "work_type",
  "סוג העבודה": "work_type",
  "עבודה": "work_type",
  "תדירות": "frequency",
  "צדדים": "sides_required",
  "צדדים נדרשים": "sides_required",
  "מחיר לקוח": "total_client_price",
  "מחיר ללקוח": "total_client_price",
  "מחיר קבלן": "total_contractor_price",
  "מחיר לקבלן": "total_contractor_price",
  "צילום חובה": "requires_photo",
  "סרטון חובה": "requires_video",
  "תאריך יעד": "due_date",
  "הערות": "admin_notes",
  "דגשים": "admin_notes",
};

export type TaskFrequency = "one_time" | "monthly" | "quarterly";

export const TEMPLATE_HEADERS = [
  "רשת",
  "סניף",
  "גורם מבצע",
  "סוג עבודה",
  "תדירות",
  "צדדים",
  "מחיר לקוח",
  "מחיר קבלן",
  "צילום חובה",
  "סרטון חובה",
];

const FREQUENCY_MAP: Record<string, TaskFrequency> = {
  one_time: "one_time",
  monthly: "monthly",
  quarterly: "quarterly",
  "חד פעמי": "one_time",
  "חד-פעמי": "one_time",
  "חודשי": "monthly",
  "רבעוני": "quarterly",
};

export interface ParsedImportTask {
  networkName: string;
  branchName: string;
  branchCity: string | null;
  branchAddress: string | null;
  executorName: string | null;
  assignedTo: string | null;
  workType: string;
  frequency: TaskFrequency;
  sidesRequired: number;
  totalClientPrice: number | null;
  totalContractorPrice: number | null;
  dueDate: string | null;
  adminNotes: string | null;
  requiresPhoto: boolean;
  requiresVideo: boolean;
}

const INVISIBLE_TEXT_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export const normalizeText = (value: unknown) => {
  if (value == null) return "";
  return String(value)
    .replace(INVISIBLE_TEXT_MARKS, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

export const normalizeLookupKey = (value: unknown) => normalizeText(value).toLowerCase();

export const buildSheetMapping = (headers: string[]) => {
  const mapping: Record<string, number> = {};
  headers.forEach((header, index) => {
    const fieldKey = HEADER_TO_FIELD[normalizeText(header)];
    if (fieldKey) mapping[fieldKey] = index;
  });
  return mapping;
};

const getCell = (row: unknown[], colMap: Record<string, number>, field: string) => {
  const col = colMap[field];
  return col != null ? row[col] : null;
};

const toNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const toInteger = (value: unknown) => {
  const parsed = toNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
};

const toBoolean = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return ["כן", "yes", "true", "1", "y"].includes(normalized);
};

const toFrequencyStrict = (value: unknown) => {
  const normalized = normalizeLookupKey(value);
  return FREQUENCY_MAP[normalized as keyof typeof FREQUENCY_MAP] ?? null;
};

const toFrequency = (value: unknown) => {
  const strictFrequency = toFrequencyStrict(value);
  if (strictFrequency) return strictFrequency;

  const normalized = normalizeLookupKey(value);
  if (!normalized) return null;
  if (normalized.includes("חד פעמ")) return "one_time";
  if (normalized.includes("רבעונ")) return "quarterly";
  if (normalized.includes("חודש")) return "monthly";
  return null;
};

const isFrequencyOnly = (value: unknown) => toFrequencyStrict(value) != null;

export const extractImportTask = (
  row: unknown[],
  colMap: Record<string, number>,
  profileMap: Record<string, string>
): ParsedImportTask | null => {
  const networkName = normalizeText(getCell(row, colMap, "network_name"));
  const branchName = normalizeText(getCell(row, colMap, "branch_name"));

  if (!networkName || !branchName) return null;

  const rawWorkType = normalizeText(getCell(row, colMap, "work_type"));
  const rawFrequency = normalizeText(getCell(row, colMap, "frequency"));
  const frequencyFromFrequency = toFrequency(rawFrequency);
  const frequencyFromWorkType = toFrequency(rawWorkType);

  let frequency = frequencyFromFrequency ?? frequencyFromWorkType ?? "one_time";
  let workType = rawWorkType || rawFrequency || "כללי";

  if (isFrequencyOnly(rawWorkType) && rawFrequency && !isFrequencyOnly(rawFrequency)) {
    frequency = frequencyFromWorkType;
    workType = rawFrequency;
  }

  const executorName = normalizeText(getCell(row, colMap, "executor")) || null;

  return {
    networkName,
    branchName,
    branchCity: normalizeText(getCell(row, colMap, "branch_city")) || null,
    branchAddress: normalizeText(getCell(row, colMap, "branch_address")) || null,
    executorName,
    assignedTo: executorName ? profileMap[normalizeLookupKey(executorName)] ?? null : null,
    workType,
    frequency,
    sidesRequired: Math.max(0, toInteger(getCell(row, colMap, "sides_required")) ?? 0),
    totalClientPrice: toNumber(getCell(row, colMap, "total_client_price")),
    totalContractorPrice: toNumber(getCell(row, colMap, "total_contractor_price")),
    dueDate: normalizeText(getCell(row, colMap, "due_date")) || null,
    adminNotes: normalizeText(getCell(row, colMap, "admin_notes")) || null,
    requiresPhoto: toBoolean(getCell(row, colMap, "requires_photo")),
    requiresVideo: toBoolean(getCell(row, colMap, "requires_video")),
  };
};