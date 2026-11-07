import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteLeadButton, LeadEditor, ReportActions } from "@/components/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadDetail } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";
import { PLATFORMS } from "@/lib/validation/schemas";

export const metadata = { title: "Lead" };

const yn = (v: boolean | null | undefined) => (v === true ? "Yes" : v === false ? "No" : "Not sure / not answered");

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getLeadDetail(id);
  if (!detail) notFound();
  const { lead, assessments, notes, consents, consultations } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-xs text-muted-foreground hover:text-foreground">← All leads</Link>
          <h1 className="mt-1 text-2xl font-semibold">{lead.full_name}</h1>
          <p className="text-sm text-muted-foreground">{lead.company} · {lead.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>Priority {lead.priority} · {lead.priority_score}</Badge>
          {lead.is_test && <Badge variant="medium">Test data</Badge>}
          <DeleteLeadButton id={lead.id} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Lead management</CardTitle></CardHeader>
          <CardContent><LeadEditor lead={lead} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Submission</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Website</dt><dd className="break-all">{lead.target_url}</dd>
              <dt className="text-muted-foreground">Website name</dt><dd>{lead.website_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Platform</dt><dd>{PLATFORMS.find((p) => p.value === lead.platform)?.label ?? "—"}</dd>
              <dt className="text-muted-foreground">Job title</dt><dd>{lead.job_title ?? "—"}</dd>
              <dt className="text-muted-foreground">Country</dt><dd>{lead.country}</dd>
              <dt className="text-muted-foreground">Company site</dt><dd className="break-all">{lead.company_website ?? "—"}</dd>
              <dt className="text-muted-foreground">App type</dt><dd>{lead.app_type ?? "—"}</dd>
              <dt className="text-muted-foreground">Registration</dt><dd>{yn(lead.has_registration)}</dd>
              <dt className="text-muted-foreground">Login</dt><dd>{yn(lead.has_login)}</dd>
              <dt className="text-muted-foreground">Payments</dt><dd>{yn(lead.processes_payments)}</dd>
              <dt className="text-muted-foreground">Customer data</dt><dd>{yn(lead.stores_customer_data)}</dd>
              <dt className="text-muted-foreground">Database</dt><dd>{yn(lead.uses_database)}</dd>
              <dt className="text-muted-foreground">Admin dashboard</dt><dd>{yn(lead.has_admin_dashboard)}</dd>
              <dt className="text-muted-foreground">Wants help</dt><dd>{lead.wants_remediation_help ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Marketing</dt><dd>{lead.marketing_consent ? `Opted in ${formatDate(lead.marketing_consent_at, true)}` : "No"}</dd>
              <dt className="text-muted-foreground">Submitted</dt><dd>{formatDate(lead.created_at, true)}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Application answers are self-reported and unverified.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assessments & reports</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {assessments.map((a: Record<string, unknown>) => {
            const reports = (Array.isArray(a.reports) ? a.reports : a.reports ? [a.reports] : []) as { id: string; report_number: string; status: string; view_count: number; pdf_downloads: number; revoked_at: string | null }[];
            return (
              <div key={String(a.id)} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/admin/assessments/${a.id}`} className="font-medium text-cyan-400 hover:underline">Assessment</Link>
                  <Badge variant="secondary">{String(a.status)}</Badge>
                  <span>Score: <strong>{a.score === null ? "—" : String(a.score)}</strong></span>
                  <span>Findings: {String(a.findings_count)}</span>
                  <span className="text-muted-foreground">{formatDate(String(a.created_at), true)}</span>
                </div>
                {reports.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                    <span>Report {r.report_number} · {r.status}{r.revoked_at ? " · revoked" : ""} · {r.view_count} views · {r.pdf_downloads} PDFs</span>
                    <ReportActions id={r.id} completed={a.status === "completed"} />
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Notes timeline</CardTitle></CardHeader>
          <CardContent>
            {!notes.length && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.author_email} · {formatDate(n.created_at, true)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Consent records & requests</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ul className="space-y-2">
              {consents.map((c, i) => (
                <li key={i} className="flex gap-2"><Badge variant={c.granted ? "success" : "outline"}>{c.granted ? "Granted" : "Declined"}</Badge><span className="text-muted-foreground">{c.consent_type.replace(/_/g, " ")} · {formatDate(c.created_at, true)}</span></li>
              ))}
            </ul>
            {consultations.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <p className="font-medium">{c.service ?? "Consultation"} · {c.status}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
