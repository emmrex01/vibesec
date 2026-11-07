import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions } from "@/components/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAssessmentDetail } from "@/lib/admin/queries";
import { CATEGORY_LABELS, type CheckCategory } from "@/lib/scanner/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Assessment" };

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getAssessmentDetail(id);
  if (!d) notFound();
  const a = d.assessment as Record<string, unknown> & { leads: { id: string; full_name: string; company: string } | null; reports: unknown };
  const report = (Array.isArray(a.reports) ? a.reports[0] : a.reports) as { id: string; report_number: string } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/assessments" className="text-xs text-muted-foreground hover:text-foreground">← All assessments</Link>
        <h1 className="mt-1 break-all text-2xl font-semibold">{String(a.target_domain)}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{String(a.status)}</Badge>
          <Badge>Score {a.score === null ? "—" : String(a.score)}</Badge>
          {a.leads && <Link className="text-cyan-400 hover:underline" href={`/admin/leads/${a.leads.id}`}>{a.leads.full_name} · {a.leads.company}</Link>}
          <span className="text-muted-foreground">{formatDate(String(a.created_at), true)} · {a.duration_ms ? `${a.duration_ms} ms` : ""} · attempts {String(a.attempts)}</span>
        </div>
        {a.error_message ? <p className="mt-2 text-sm text-red-300">{String(a.error_message)}</p> : null}
      </div>
      {report && (
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm"><span>Report {report.report_number}</span><ReportActions id={report.id} completed={a.status === "completed"} /></CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Findings ({d.findings.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {d.findings.map((f) => (
            <details key={f.id} className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer"><Badge variant={f.severity} className="mr-2">{f.severity}</Badge>{f.title}</summary>
              <p className="mt-2">{f.observation}</p>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-navy-950 p-3 font-mono text-xs text-muted-foreground">{JSON.stringify(f.evidence, null, 2)}</pre>
            </details>
          ))}
        </CardContent>
      </Card>
      <Table>
        <THead><tr><TH>Category</TH><TH>Check</TH><TH>Status</TH><TH>Points</TH><TH>Summary / evidence</TH></tr></THead>
        <TBody>
          {d.checks.map((c) => (
            <TR key={c.id}>
              <TD className="whitespace-nowrap">{CATEGORY_LABELS[c.category as CheckCategory] ?? c.category}</TD>
              <TD>{c.title}</TD>
              <TD><Badge variant={c.status === "pass" ? "success" : c.status === "fail" ? "high" : c.status === "warn" ? "medium" : "outline"}>{c.status}</Badge></TD>
              <TD className="tabular-nums">{Number(c.earned_points)}/{Number(c.max_points)}</TD>
              <TD>
                <p>{c.summary}</p>
                <details><summary className="cursor-pointer text-xs text-muted-foreground">Evidence</summary><pre className="max-h-48 overflow-auto font-mono text-xs text-muted-foreground">{JSON.stringify(c.evidence, null, 2)}</pre></details>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
