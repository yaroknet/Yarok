import { cn } from "@/lib/utils";

interface RatingPillsProps {
  value: number | null;
  onChange: (n: number) => void;
  name?: string;
}

export const RatingPills = ({ value, onChange, name }: RatingPillsProps) => {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "h-11 w-11 rounded-full border-2 text-base font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary",
            value === n
              ? "bg-primary text-primary-foreground border-primary shadow-md scale-110"
              : "bg-background text-foreground border-border hover:border-primary/60",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
};
