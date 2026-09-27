import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: 
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: 
          "border-transparent bg-secondary text-secondary-foreground",
        destructive: 
          "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        outline: 
          "text-foreground border-border",
        success:
          "border-transparent bg-status-success/10 text-status-success border-status-success/20",
        warning:
          "border-transparent bg-status-warning/10 text-status-warning border-status-warning/20",
        info:
          "border-transparent bg-status-info/10 text-status-info border-status-info/20",
        muted:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
