import { Card, CardContent } from "@/employees/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  ringColor?: string;
  ringPercent?: number;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, ringColor = "hsl(217, 91%, 60%)", ringPercent = 100 }: StatCardProps) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (ringPercent / 100) * circumference;

  return (
    <Card className="shadow-md border-0 rounded-2xl bg-card">
      <CardContent className="p-4 flex flex-col items-center gap-2">
        {/* Circular ring with icon */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-5 w-5" style={{ color: ringColor }} />
          </div>
        </div>
        {/* Value */}
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {/* Title */}
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        {/* Subtitle */}
        {subtitle && <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
            {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
