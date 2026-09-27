import * as React from "react";
import { cn } from "@/lib/utils";

interface PulsingDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "destructive" | "warning";
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

const colorClasses = {
  primary: "bg-primary",
  destructive: "bg-destructive",
  warning: "bg-yellow-500",
};

const PulsingDot = React.forwardRef<HTMLSpanElement, PulsingDotProps>(
  ({ className, size = "md", color = "primary", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "relative flex",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Pulsing ring */}
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            colorClasses[color]
          )}
        />
        {/* Solid dot */}
        <span
          className={cn(
            "relative inline-flex rounded-full",
            sizeClasses[size],
            colorClasses[color]
          )}
        />
      </span>
    );
  }
);

PulsingDot.displayName = "PulsingDot";

export { PulsingDot };