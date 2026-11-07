import Link from "next/link";
import { ReportActions } from "@/components/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listReports, PAGE_SIZE } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };
type Row = { id: string; report_number: string; status: string; view_count: number; pdf_downloads: number; generated_at: string | null; revoked_at: string | null; token_expires_at: string; lead_id: string; leads: { full_name: string; company: string } | null; assessments: { target_domain: string; score: number | null } | null };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Number((await searchParams).page ?? 1) || 1;
  const { rows, total } = await listReports(page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports <span className="text-base font-normal text-muted-foreground">({total})</span></h1>
      <Table>
        <THead><tr><TH>Report</TH><TH>Website</TH><TH>Lead</TH><TH>Status</TH><TH>Views / PDFs</TH><TH>Link expires</TH><TH>Actions</TH></tr></THead>
        <TBody>
          {(rows as unknown as Row[]).map((r) => (
            <TR key={r.id}>
              <TD className="font-mono text-xs">{r.report_number}</TD>
              <TD className="break-all">{r.assessments?.target_domain} {r.assessments?.score != null && <span className="text-muted-foreground">· {r.assessments.score}</span>}</TD>
              <TD><Link className="text-cyan-400 hover:underline" href={`/admin/leads/${r.lead_id}`}>{r.leads?.full_name}</Link></TD>
              <TD><Badge variant={r.status === "ready" ? "success" : r.status === "failed" ? "high" : "secondary"}>{r.revoked_at ? "revoked" : r.status}</Badge></TD>
              <TD className="tabular-nums">{r.view_count} / {r.pdf_downloads}</TD>
              <TD className="whitespace-nowrap">{formatDate(r.token_expires_at)}</TD>
              <TD><ReportActions id={r.id} completed={r.status === "ready"} /></TD>
            </TR>
          ))}
          {!rows.length && <tr><TD colSpan={7} className="py-10 text-center text-muted-foreground">No reports yet.</TD></tr>}
        </TBody>
      </Table>
      {pages > 1 && <p className="text-sm text-muted-foreground">Page {page} of {pages} {page < pages && <Link className="text-cyan-400" href={`?page=${page + 1}`}>Next →</Link>}</p>}
    </div>
  );
}
