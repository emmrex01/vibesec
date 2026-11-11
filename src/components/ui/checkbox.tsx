import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn("mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input bg-navy-950 accent-[hsl(var(--primary))]", className)}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";
