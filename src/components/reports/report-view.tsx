"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Download,
  Info,
  Loader2,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PublicReport } from "@/lib/reports/view-model";
import { cn, formatDate, whatsappLink } from "@/lib/utils";

type Status = "queued" | "running" | "completed" | "failed";
type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "progress"; status: Status; domain?: string } | { kind: "ready"; report: PublicReport };

const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", informational: "Informational" };
const STAGES = ["Validating destination", "Checking HTTPS and certificate", "Inspecting security headers and cookies", "Reviewing DNS and email configuration", "Building your report"];

export interface ReportContact {
  businessName: string;
  email: string | null;
  whatsapp: string | null;
  bookingUrl: string | null;
}

export function ReportView({ token, contact }: { token: string; contact: ReportContact }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [elapsed, setElapsed] = useState(0);
  const runRequested = useRef(0);
  const auth = { Authorization: `Bearer ${token}` };

  const loadReport = useCallback(async () => {
    const res = await fetch(`/api/report/${token}?view=1`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setPhase({ kind: "error", message: data?.error?.message ?? "This report could not be loaded." });
      return;
    }
    setPhase({ kind: "ready", report: data.report });
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/assessment/status", { headers: auth, cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setPhase({ kind: "error", message: data?.error?.message ?? "This report link is not valid." });
          return;
        }
        const status = data.status as Status;
        if (status === "completed") return loadReport();
        if (status === "failed") {
          setPhase({ kind: "error", message: data.message ?? "The assessment could not be completed." });
          return;
        }
        setPhase({ kind: "progress", status, domain: data.domain });
        // Ask the server to run (idempotent). Re-ask occasionally if it stays queued (capacity limit or lost background job).
        const sinceRun = Date.now() - runRequested.current;
        if (status === "queued" && sinceRun > 15_000) {
          runRequested.current = Date.now();
          void fetch("/api/assessment/run", { method: "POST", headers: auth }).catch(() => undefined);
        }
      } catch {
        // transient network error — keep polling
      }
      setElapsed(Math.floor((Date.now() - started) / 1000));
      if (Date.now() - started < 5 * 60_000) timer = setTimeout(poll, 2500);
      else setPhase({ kind: "error", message: "The assessment is taking longer than expected. Please refresh this page in a few minutes." });
    };
    runRequested.current = Date.now() - 12_000; // first run request ~3s after load, giving the background job a head start
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadReport]);

  if (phase.kind === "loading") return <Centered><Loader2 className="size-6 animate-spin text-cyan-400" /> Loading…</Centered>;
  if (phase.kind === "error")
    return (
      <div className="mx-auto max-w-xl py-24">
        <Alert variant="destructive" className="p-5">
          <p className="font-semibold">{phase.message}</p>
          <p className="mt-2 text-red-200/80">If you believe this is a mistake, you can request a new assessment.</p>
        </Alert>
        <Link href="/assessment" className={cn(buttonVariants(), "mt-6")}>Start a new assessment</Link>
      </div>
    );
  if (phase.kind === "progress") {
    const stage = Math.min(STAGES.length - 1, Math.floor(elapsed / 6));
    return (
      <div className="mx-auto max-w-xl py-20" aria-live="polite">
        <Card>
          <CardHeader>
            <p className="eyebrow">Assessment in progress</p>
            <CardTitle className="text-2xl">Checking {phase.domain ?? "your website"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {phase.status === "queued" ? "Your assessment is queued and will start shortly." : "Running passive, non-intrusive checks. This usually takes under a minute."}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Progress value={Math.min(92, 8 + elapsed * 3)} label="Assessment progress" />
            <ol className="space-y-2 text-sm">
              {STAGES.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2", i > stage ? "text-muted-foreground/60" : i === stage ? "text-foreground" : "text-muted-foreground")}>
                  {i < stage ? <CheckCircle2 className="size-4 text-cyan-400" /> : i === stage ? <Loader2 className="size-4 animate-spin text-cyan-400" /> : <span className="size-4 rounded-full border" />}
                  {s}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Keep this page open, or bookmark it — the link is private to you. We&apos;ll also email you when the report is ready.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <ReportBody report={phase.report} token={token} contact={contact} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-3 py-32 text-muted-foreground">{children}</div>;
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  const color = score === null ? "#8b98b3" : score >= 80 ? "#34d399" : score >= 60 ? "#3fd0e8" : score >= 40 ? "#f2c14b" : "#f2814b";
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums">{score ?? "—"}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="size-4 text-emerald-400" aria-label="Passed" />;
  if (status === "warn" || status === "fail") return <AlertTriangle className="size-4 text-sev-medium" aria-label="Needs attention" />;
  if (status === "info") return <Info className="size-4 text-sev-low" aria-label="Informational" />;
  return <CircleSlash className="size-4 text-muted-foreground" aria-label={status === "unavailable" ? "Unavailable" : "Not applicable"} />;
}

function ReportBody({ report, token, contact }: { report: PublicReport; token: string; contact: ReportContact }) {
  const wa = whatsappLink(contact.whatsapp, `Hi ${contact.businessName}, I'd like to discuss my security health report ${report.reportNumber}.`);
  const consultHref = `/contact?source=report&service=${encodeURIComponent("Vulnerability remediation")}`;

  return (
    <div className="space-y-8 py-10">
      {/* Executive summary */}
      <Card className="overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
          <ScoreRing score={report.score} />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Report {report.reportNumber}</Badge>
              <Badge variant="outline">{formatDate(report.assessmentDate, true)}</Badge>
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {report.websiteName ? `${report.websiteName} · ` : ""}
              <span className="break-all">{report.domain}</span>
            </h1>
            <p className="text-lg font-medium text-cyan-400">{report.bandLabel ?? "Score not calculated"}</p>
            <p className="text-muted-foreground">{report.summaryText}</p>
          </div>
        </div>
        <div className="border-t bg-secondary/30 px-6 py-4 text-xs text-muted-foreground sm:px-8">
          <ShieldAlert className="mr-1.5 inline size-4 text-sev-medium" aria-hidden />
          {report.disclaimer}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a href={`/api/report/${token}/pdf`} className={buttonVariants({ variant: "secondary" })} download>
          <Download /> Download PDF report
        </a>
        <Link href={consultHref} className={buttonVariants()}>Want Help Fixing These Findings?</Link>
      </div>

      {/* Check results */}
      <section aria-labelledby="results" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <h2 id="results" className="sr-only">Security check results</h2>
        {[
          ["Checks performed", report.counts.performed],
          ["Passed", report.counts.passed],
          ["Needing attention", report.counts.attention],
          ["Unavailable", report.counts.unavailable],
          ["Findings", report.counts.findings],
        ].map(([label, value]) => (
          <Card key={label as string} className="p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {Object.entries(report.findingsBySeverity).map(([sev, n]) => (
          <Badge key={sev} variant={sev as "critical"}>{SEV_LABEL[sev]}: {n}</Badge>
        ))}
      </div>

      {/* Findings */}
      <section aria-labelledby="findings" className="space-y-3">
        <h2 id="findings" className="text-xl font-semibold">Detailed findings</h2>
        {!report.findings.length && <Alert variant="success">No findings were raised by the automated checks performed.</Alert>}
        {report.findings.map((f, i) => (
          <details key={`${f.key}-${i}`} className="group rounded-xl border bg-card/60 open:bg-card" open={i < 3 && (f.severity === "high" || f.severity === "medium")}>
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <Badge variant={f.severity as "critical"}>{SEV_LABEL[f.severity]}</Badge>
              <span className="flex-1 font-medium">{f.title}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-4 border-t px-4 py-4 text-sm md:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observation</p><p className="mt-1">{f.observation}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</p><p className="mt-1 text-muted-foreground">{f.explanation}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Potential business impact</p><p className="mt-1 text-muted-foreground">{f.impact}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended improvement</p><p className="mt-1">{f.remediation}</p></div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-navy-950 p-3 font-mono text-xs text-muted-foreground">{JSON.stringify(f.evidence, null, 2)}</pre>
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">Confidence: {f.confidence}. {f.limitation}</p>
            </div>
          </details>
        ))}
      </section>

      {/* All checks */}
      <section aria-labelledby="checks" className="space-y-4">
        <h2 id="checks" className="text-xl font-semibold">All checks</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {report.checksByCategory.map((g) => (
            <Card key={g.category}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{g.label}</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {g.checks.map((c) => (
                    <li key={c.key} className="flex gap-3 py-2.5 text-sm">
                      <StatusIcon status={c.status} />
                      <div className="min-w-0">
                        <p className="font-medium">{c.title}</p>
                        <p className="break-words text-muted-foreground">{c.summary}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      <section aria-labelledby="recs" className="grid gap-4 lg:grid-cols-2">
        <h2 id="recs" className="sr-only">Remediation recommendations</h2>
        <Card>
          <CardHeader><CardTitle className="text-base">Based on this assessment</CardTitle></CardHeader>
          <CardContent>
            {report.findings.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {[...new Map(report.findings.map((f) => [f.title, f])).values()].map((f) => (
                  <li key={f.title}><span className="text-foreground">{f.title}:</span> {f.remediation}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific remediation items arose from these checks.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General good practice</CardTitle>
            <p className="text-xs text-muted-foreground">Not based on findings from this assessment.</p>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {report.generalRecommendations.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      </section>

      {report.technologies.length > 0 && (
        <section aria-labelledby="tech">
          <h2 id="tech" className="mb-3 text-xl font-semibold">Technology indicators</h2>
          <div className="flex flex-wrap gap-2">
            {report.technologies.map((t) => (
              <Badge key={t.name} variant="secondary" title={t.evidence}>{t.name} · {t.confidence}</Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Detected from passive public signals. These do not confirm how the website was built.</p>
        </section>
      )}

      <section aria-labelledby="limits">
        <h2 id="limits" className="mb-2 text-sm font-semibold text-muted-foreground">Assessment limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {report.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      {/* Next steps */}
      <Card className="relative overflow-hidden border-primary/30">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative space-y-4 p-6 sm:p-8">
          <ShieldCheck className="size-8 text-cyan-400" aria-hidden />
          <h2 className="text-2xl font-semibold">Want Help Fixing These Findings?</h2>
          <div className="max-w-2xl space-y-2 text-muted-foreground">
            <p>Your website has been assessed using our preliminary automated security checks.</p>
            <p>Some security concerns may require deeper investigation and manual verification.</p>
            <p>{contact.businessName} can help you review your application, investigate identified issues and implement appropriate security improvements.</p>
            <p>Contact our team to discuss a professional assessment and remediation plan.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={consultHref} className={buttonVariants({ size: "lg" })}>Request a Professional Security Assessment</Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <MessageCircle /> Discuss Your Website Security With {contact.businessName}
              </a>
            )}
            {!wa && contact.email && (
              <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Security health report ${report.reportNumber}`)}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
                Discuss Your Website Security With {contact.businessName}
              </a>
            )}
            {contact.bookingUrl && (
              <a href={contact.bookingUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg", variant: "ghost" })}>Book a call</a>
            )}
          </div>
        </div>
      </Card>
      <Button variant="link" className="px-0" onClick={() => window.print()}>Print this page</Button>
    </div>
  );
}
