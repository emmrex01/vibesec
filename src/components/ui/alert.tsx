import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" }) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variant === "default" && "border-border bg-secondary/50 text-foreground",
        variant === "destructive" && "border-destructive/40 bg-destructive/10 text-red-200",
        variant === "success" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
        className,
      )}
      {...props}
    />
  );
}
