import { CheckCircle2, AlertTriangle, Lock, Globe, Cookie, Server } from "lucide-react";

/** Illustrative dashboard (static artwork — not real assessment data). */
export function HeroVisual() {
  const rows = [
    { icon: Lock, label: "HTTPS & TLS", state: "ok", value: "Valid certificate" },
    { icon: Server, label: "Security headers", state: "warn", value: "3 to review" },
    { icon: Cookie, label: "Cookie configuration", state: "ok", value: "Secure" },
    { icon: Globe, label: "DNS & email", state: "warn", value: "DMARC missing" },
  ] as const;
  return (
    <div className="relative" aria-label="Illustrative example of a security health dashboard" role="img">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-accent/20 via-primary/10 to-transparent blur-2xl" aria-hidden />
      <div className="relative rounded-2xl border bg-navy-900/90 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-400" />
            example-app.com
          </div>
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Illustrative example</span>
        </div>
        <div className="flex items-center gap-5 rounded-xl border bg-navy-950/70 p-4">
          <div className="relative size-20">
            <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#3fd0e8" strokeWidth="8" strokeLinecap="round" strokeDasharray="213.6" strokeDashoffset="53" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">75</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Improvement recommended</p>
            <p className="text-xs text-muted-foreground">24 checks · 18 passed · 6 to review</p>
            <div className="mt-2 flex gap-1.5">
              {["bg-sev-medium", "bg-sev-low", "bg-sev-low", "bg-sev-info", "bg-sev-info"].map((c, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${c}`} />
              ))}
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 rounded-lg border bg-navy-950/40 px-3 py-2.5 text-sm">
              <r.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="flex-1">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.value}</span>
              {r.state === "ok" ? <CheckCircle2 className="size-4 text-emerald-400" aria-hidden /> : <AlertTriangle className="size-4 text-sev-medium" aria-hidden />}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Assessment progress</span><span>100%</span></div>
          <div className="h-1.5 rounded-full bg-secondary"><div className="h-full w-full rounded-full bg-gradient-to-r from-accent to-primary" /></div>
        </div>
      </div>
    </div>
  );
}
