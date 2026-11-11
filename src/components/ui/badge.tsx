import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-primary/30 bg-primary/10 text-cyan-400",
      secondary: "border-border bg-secondary text-secondary-foreground",
      outline: "border-border text-muted-foreground",
      critical: "border-sev-critical/40 bg-sev-critical/10 text-sev-critical",
      high: "border-sev-high/40 bg-sev-high/10 text-sev-high",
      medium: "border-sev-medium/40 bg-sev-medium/10 text-sev-medium",
      low: "border-sev-low/40 bg-sev-low/10 text-sev-low",
      informational: "border-sev-info/40 bg-sev-info/10 text-sev-info",
      success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
