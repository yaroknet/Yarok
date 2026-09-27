import { useState, useEffect } from "react";
import { Button } from "@/employees/components/ui/button";
import { Input } from "@/employees/components/ui/input";
import { Label } from "@/employees/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/employees/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/employees/components/ui/popover";
import { Bell, BellOff } from "lucide-react";
import { Checkbox } from "@/employees/components/ui/checkbox";

// Formats stored in DB:
// "every_Xm" (minutes), "every_Xh" (hours), "every_Xd" (days), "every_Xw" (weeks)
// "at_HH:MM" (fixed time once daily)
// "weekly_0,1,2_HH:MM" (specific weekdays at time)
// "once_YYYY-MM-DDTHH:MM" (one-time future date)
// null = no reminder

const WEEKDAY_LABELS = [
  { value: 0, label: "א׳" },
  { value: 1, label: "ב׳" },
  { value: 2, label: "ג׳" },
  { value: 3, label: "ד׳" },
  { value: 4, label: "ה׳" },
  { value: 5, label: "ו׳" },
  { value: 6, label: "ש׳" },
];

export function parseReminderLabel(freq: string | null): string {
  if (!freq) return "ללא תזכורת";

  if (freq.startsWith("every_")) {
    const raw = freq.replace("every_", "");
    if (raw.endsWith("m")) {
      const val = parseFloat(raw.replace("m", ""));
      return `כל ${val} דקות`;
    }
    if (raw.endsWith("w")) {
      const val = parseFloat(raw.replace("w", ""));
      return val === 1 ? "כל שבוע" : `כל ${val} שבועות`;
    }
    if (raw.endsWith("d")) {
      const val = parseFloat(raw.replace("d", ""));
      return val === 1 ? "כל יום" : `כל ${val} ימים`;
    }
    if (raw.endsWith("h")) {
      const val = parseFloat(raw.replace("h", ""));
      if (val < 1) return `כל ${Math.round(val * 60)} דקות`;
      return val === 1 ? "כל שעה" : `כל ${val} שעות`;
    }
  }

  if (freq.startsWith("weekly_")) {
    const parts = freq.replace("weekly_", "");
    const [daysPart, time] = parts.split("_");
    const days = daysPart.split(",").map(Number);
    const dayLabels = days.map(d => WEEKDAY_LABELS.find(w => w.value === d)?.label || "").join(", ");
    return `ימים ${dayLabels} בשעה ${time || "09:00"}`;
  }

  if (freq.startsWith("once_")) {
    const dt = freq.replace("once_", "");
    try {
      const date = new Date(dt);
      return `חד-פעמי: ${date.toLocaleDateString("he-IL")} ${date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return freq;
    }
  }

  if (freq.startsWith("at_")) return `בשעה ${freq.replace("at_", "")}`;
  if (freq.startsWith("daily_")) return `פעם ביום (${freq.replace("daily_", "")})`;

  // Legacy
  if (freq === "every_hour") return "כל שעה";
  if (freq === "every_3_hours") return "כל 3 שעות";
  if (freq === "every_5_hours") return "כל 5 שעות";
  if (freq === "at_14") return "בשעה 14:00";
  if (freq === "daily") return "פעם ביום (09:00)";
  return freq;
}

type ReminderMode = "interval" | "fixed_time" | "weekly_days" | "once_datetime";
type IntervalUnit = "minutes" | "hours" | "days" | "weeks";

interface ReminderPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  compact?: boolean;
}

function parseExisting(value: string | null): {
  mode: ReminderMode;
  amount: string;
  unit: IntervalUnit;
  fixedTime: string;
  weekDays: number[];
  weekTime: string;
  onceDate: string;
  onceTime: string;
} {
  const base = { amount: "1", unit: "hours" as IntervalUnit, fixedTime: "09:00", weekDays: [] as number[], weekTime: "09:00", onceDate: "", onceTime: "09:00" };
  if (!value) return { mode: "interval", ...base };

  if (value.startsWith("every_")) {
    const raw = value.replace("every_", "");
    if (raw.endsWith("m")) return { ...base, mode: "interval", amount: raw.replace("m", ""), unit: "minutes" };
    if (raw.endsWith("w")) return { ...base, mode: "interval", amount: raw.replace("w", ""), unit: "weeks" };
    if (raw.endsWith("d")) return { ...base, mode: "interval", amount: raw.replace("d", ""), unit: "days" };
    if (raw.endsWith("h")) return { ...base, mode: "interval", amount: raw.replace("h", ""), unit: "hours" };
  }
  if (value.startsWith("weekly_")) {
    const parts = value.replace("weekly_", "");
    const [daysPart, time] = parts.split("_");
    return { ...base, mode: "weekly_days", weekDays: daysPart.split(",").map(Number), weekTime: time || "09:00" };
  }
  if (value.startsWith("once_")) {
    const dt = value.replace("once_", "");
    const [d, t] = dt.split("T");
    return { ...base, mode: "once_datetime", onceDate: d || "", onceTime: t || "09:00" };
  }
  if (value.startsWith("at_")) return { ...base, mode: "fixed_time", fixedTime: value.replace("at_", "") };
  if (value.startsWith("daily_")) return { ...base, mode: "fixed_time", fixedTime: value.replace("daily_", "") };

  return { mode: "interval", ...base };
}

export function ReminderPicker({ value, onChange, compact = false }: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseExisting(value);
  const [mode, setMode] = useState<ReminderMode>(parsed.mode);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState<IntervalUnit>(parsed.unit);
  const [fixedTime, setFixedTime] = useState(parsed.fixedTime);
  const [weekDays, setWeekDays] = useState<number[]>(parsed.weekDays);
  const [weekTime, setWeekTime] = useState(parsed.weekTime);
  const [onceDate, setOnceDate] = useState(parsed.onceDate);
  const [onceTime, setOnceTime] = useState(parsed.onceTime);

  // Re-sync local state from `value` whenever the popover opens or the external value changes.
  // Without this, opening the editor shows stale state (e.g. previously-picked weekdays missing).
  useEffect(() => {
    if (!open) return;
    const p = parseExisting(value);
    setMode(p.mode);
    setAmount(p.amount);
    setUnit(p.unit);
    setFixedTime(p.fixedTime);
    setWeekDays(p.weekDays);
    setWeekTime(p.weekTime);
    setOnceDate(p.onceDate);
    setOnceTime(p.onceTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const apply = () => {
    if (mode === "interval") {
      const suffixMap: Record<IntervalUnit, string> = {
        minutes: "m", hours: "h", days: "d", weeks: "w"
      };
      onChange(`every_${amount}${suffixMap[unit]}`);
    } else if (mode === "fixed_time") {
      onChange(`at_${fixedTime}`);
    } else if (mode === "weekly_days") {
      if (weekDays.length === 0) return;
      const sorted = [...weekDays].sort((a, b) => a - b);
      onChange(`weekly_${sorted.join(",")}_${weekTime}`);
    } else if (mode === "once_datetime") {
      if (!onceDate) return;
      onChange(`once_${onceDate}T${onceTime}`);
    }
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  const toggleWeekDay = (day: number) => {
    setWeekDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const label = parseReminderLabel(value);

  const formContent = (
    <div className="space-y-3" dir="rtl">
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "כל 30 דק׳", val: "every_30m" },
          { label: "כל שעה", val: "every_1h" },
          { label: "כל 3 שעות", val: "every_3h" },
          { label: "כל יום", val: "every_1d" },
          { label: "כל שבוע", val: "every_1w" },
        ].map((preset) => (
          <Button
            key={preset.val}
            variant={value === preset.val ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (value === preset.val) {
                onChange(null);
              } else {
                onChange(preset.val);
              }
              setOpen(false);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="border-t pt-3 space-y-3">
        <Label className="text-sm font-medium">התאמה אישית</Label>

        <Select value={mode} onValueChange={(v) => setMode(v as ReminderMode)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval">כל פרק זמן קבוע</SelectItem>
            <SelectItem value="fixed_time">בשעה קבועה (פעם ביום)</SelectItem>
            <SelectItem value="weekly_days">ימים קבועים בשבוע</SelectItem>
            <SelectItem value="once_datetime">תאריך ושעה עתידיים</SelectItem>
          </SelectContent>
        </Select>

        {mode === "interval" && (
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">כל</span>
            <Input
              type="number"
              min="1"
              max="99"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 w-16 text-center"
            />
            <Select value={unit} onValueChange={(v) => setUnit(v as IntervalUnit)}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">דקות</SelectItem>
                <SelectItem value="hours">שעות</SelectItem>
                <SelectItem value="days">ימים</SelectItem>
                <SelectItem value="weeks">שבועות</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "fixed_time" && (
          <div className="space-y-1">
            <Label className="text-xs">באיזו שעה?</Label>
            <Input
              type="time"
              value={fixedTime}
              onChange={(e) => setFixedTime(e.target.value)}
              className="h-8 w-32"
            />
          </div>
        )}

        {mode === "weekly_days" && (
          <div className="space-y-2">
            <Label className="text-xs">בחר ימים</Label>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAY_LABELS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekDay(day.value)}
                  className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                    weekDays.includes(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">באיזו שעה?</Label>
              <Input
                type="time"
                value={weekTime}
                onChange={(e) => setWeekTime(e.target.value)}
                className="h-8 w-32"
              />
            </div>
          </div>
        )}

        {mode === "once_datetime" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">תאריך</Label>
              <Input
                type="date"
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                className="h-8 w-44"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">שעה</Label>
              <Input
                type="time"
                value={onceTime}
                onChange={(e) => setOnceTime(e.target.value)}
                className="h-8 w-32"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={apply} className="flex-1">הגדר תזכורת</Button>
        <Button size="sm" variant="outline" onClick={clear}>ביטול</Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            {value ? (
              <>
                <Bell className="h-3 w-3 text-orange-500" />
                <span className="text-orange-600">{label}</span>
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" />
                <span>תזכורת</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" dir="rtl" align="start">
          {formContent}
        </PopoverContent>
      </Popover>
    );
  }

  return <div className="space-y-2">{formContent}</div>;
}
