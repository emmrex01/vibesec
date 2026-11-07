import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listAssessments, PAGE_SIZE } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Assessments" };
type Row = { id: string; target_domain: string; status: string; score: number | null; findings_count: number; created_at: string; leads: { full_name: string; company: string } | null };

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const { rows, total } = await listAssessments(page, sp.status);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Assessments <span className="text-base font-normal text-muted-foreground">({total})</span></h1>
        <div className="flex gap-1">
          {["", "queued", "running", "completed", "failed"].map((s) => (
            <Link key={s} href={s ? `?status=${s}` : "?"} className={buttonVariants({ size: "sm", variant: (sp.status ?? "") === s ? "secondary" : "ghost" })}>{s || "All"}</Link>
          ))}
        </div>
      </div>
      <Table>
        <THead><tr><TH>Assessment ID</TH><TH>Target website</TH><TH>Lead</TH><TH>Score</TH><TH>Findings</TH><TH>Date</TH><TH>Status</TH></tr></THead>
        <TBody>
          {(rows as unknown as Row[]).map((a) => (
            <TR key={a.id}>
              <TD><Link href={`/admin/assessments/${a.id}`} className="font-mono text-xs text-cyan-400 hover:underline">{a.id.slice(0, 8)}</Link></TD>
              <TD className="break-all">{a.target_domain}</TD>
              <TD>{a.leads ? `${a.leads.full_name} · ${a.leads.company}` : "—"}</TD>
              <TD className="tabular-nums">{a.score ?? "—"}</TD>
              <TD>{a.findings_count}</TD>
              <TD className="whitespace-nowrap">{formatDate(a.created_at, true)}</TD>
              <TD><Badge variant={a.status === "completed" ? "success" : a.status === "failed" ? "high" : "secondary"}>{a.status}</Badge></TD>
            </TR>
          ))}
          {!rows.length && <tr><TD colSpan={7} className="py-10 text-center text-muted-foreground">No assessments yet.</TD></tr>}
        </TBody>
      </Table>
      {pages > 1 && <p className="text-sm text-muted-foreground">Page {page} of {pages} {page < pages && <Link className="text-cyan-400" href={`?page=${page + 1}${sp.status ? `&status=${sp.status}` : ""}`}>Next →</Link>}</p>}
    </div>
  );
}
