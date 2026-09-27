import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/employees/components/ui/sheet";
import { Button } from "@/employees/components/ui/button";
import { SlidersHorizontal, Check } from "lucide-react";

export type SortOption = "due_date" | "client" | "urgency" | "type";

interface SortFilterSheetProps {
  current: SortOption;
  onChange: (opt: SortOption) => void;
}

const options: { value: SortOption; label: string }[] = [
  { value: "due_date", label: "תאריך יעד" },
  { value: "client", label: "לקוח" },
  { value: "urgency", label: "דחיפות" },
  { value: "type", label: "סוג עבודה" },
];

export function SortFilterSheet({ current, onChange }: SortFilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className="fixed bottom-20 left-4 z-40 h-12 w-12 rounded-full shadow-elevated"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-right">מיון לפי</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 mt-4 pb-4">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                current === opt.value
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <span>{opt.label}</span>
              {current === opt.value && <Check className="h-5 w-5" />}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
