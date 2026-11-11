import * as React from "react";
import { Label } from "./label";

export function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-cyan-400"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
