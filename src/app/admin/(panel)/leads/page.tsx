import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listLeads, PAGE_SIZE, type LeadFilters } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, PLATFORMS, type LeadStatus } from "@/lib/validation/schemas";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filters: LeadFilters = { q: sp.q, status: sp.status, priority: sp.priority, country: sp.country, platform: sp.platform, from: sp.from, to: sp.to, result: sp.result, page: Number(sp.page ?? 1) || 1 };
  const { rows, total } = await listLeads(filters);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">{total} matching lead{total === 1 ? "" : "s"}</p>
        </div>
        <a href={`/api/admin/export?${qs.toString()}`} className={buttonVariants({ variant: "secondary", size: "sm" })}><Download /> Export CSV</a>
      </div>

      <form method="get" className="grid gap-3 rounded-xl border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input name="q" placeholder="Search email, domain, company…" defaultValue={sp.q} aria-label="Search" />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </Select>
        <Select name="priority" defaultValue={sp.priority ?? ""} aria-label="Priority">
          <option value="">All priorities</option>
          {["A", "B", "C"].map((p) => <option key={p} value={p}>Priority {p}</option>)}
        </Select>
        <Select name="platform" defaultValue={sp.platform ?? ""} aria-label="Platform">
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <Input name="country" placeholder="Country" defaultValue={sp.country} aria-label="Country" />
        <Select name="result" defaultValue={sp.result ?? ""} aria-label="Assessment result">
          <option value="">Any assessment result</option>
          <option value="good">80–100 Good</option>
          <option value="improvement">60–79 Improvement</option>
          <option value="several">40–59 Several improvements</option>
          <option value="significant">0–39 Significant concerns</option>
        </Select>
        <div className="flex gap-2">
          <Input type="date" name="from" defaultValue={sp.from} aria-label="From date" />
          <Input type="date" name="to" defaultValue={sp.to} aria-label="To date" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Filter</Button>
          <Link href="/admin/leads" className={buttonVariants({ variant: "ghost" })}>Reset</Link>
        </div>
      </form>

      <Table>
        <THead>
          <tr><TH>Name</TH><TH>Company</TH><TH>Email</TH><TH>Website</TH><TH>Country</TH><TH>Platform</TH><TH>Score</TH><TH>Priority</TH><TH>Status</TH><TH>Submitted</TH></tr>
        </THead>
        <TBody>
          {rows.map((r) => {
            const a = r.assessments?.[0];
            return (
              <TR key={r.id}>
                <TD><Link className="font-medium text-cyan-400 hover:underline" href={`/admin/leads/${r.id}`}>{r.full_name}</Link></TD>
                <TD>{r.company}</TD>
                <TD className="break-all">{r.email}</TD>
                <TD className="break-all">{r.target_domain}</TD>
                <TD>{r.country}</TD>
                <TD>{PLATFORMS.find((p) => p.value === r.platform)?.label ?? "—"}</TD>
                <TD className="tabular-nums">{a?.score ?? (a?.status ?? "—")}</TD>
                <TD><Badge variant={r.priority === "A" ? "default" : r.priority === "B" ? "secondary" : "outline"}>{r.priority}</Badge></TD>
                <TD className="whitespace-nowrap">{LEAD_STATUS_LABELS[r.status as LeadStatus] ?? r.status}</TD>
                <TD className="whitespace-nowrap">{formatDate(r.created_at)}</TD>
              </TR>
            );
          })}
          {!rows.length && <tr><TD colSpan={10} className="py-10 text-center text-muted-foreground">No leads match these filters.</TD></tr>}
        </TBody>
      </Table>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {filters.page} of {pages}</span>
          <div className="flex gap-2">
            {filters.page! > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?${qs.toString()}&page=${filters.page! - 1}`}>Previous</Link>}
            {filters.page! < pages && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?${qs.toString()}&page=${filters.page! + 1}`}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
