import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { overviewStats } from "@/lib/admin/queries";

export const metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const s = await overviewStats(from, to);
  const tiles: [string, string | number, string?][] = [
    ["Total leads", s.totalLeads, "/admin/leads"],
    ["Total assessments", s.totalAssessments, "/admin/assessments"],
    ["Completed assessments", s.completed, "/admin/assessments?status=completed"],
    ["Average score", s.averageScore ?? "—"],
    ["Priority A prospects", s.priorityA, "/admin/leads?priority=A"],
    ["Priority B prospects", s.priorityB, "/admin/leads?priority=B"],
    ["Reports generated", s.reportsReady, "/admin/reports"],
    ["Consultation requests", s.consultations, "/admin/consultations"],
    ["Converted customers", s.converted, "/admin/leads?status=converted"],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">{from || to ? `Filtered ${from ?? "…"} → ${to ?? "…"}` : "All time"}</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-muted-foreground">From<Input type="date" name="from" defaultValue={from} className="h-9" /></label>
          <label className="text-xs text-muted-foreground">To<Input type="date" name="to" defaultValue={to} className="h-9" /></label>
          <Button size="sm" type="submit">Apply</Button>
          {(from || to) && <Link href="/admin/dashboard" className="px-2 text-xs text-muted-foreground hover:text-foreground">Clear</Link>}
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([label, value, href]) => {
          const body = (
            <Card className="p-5 transition-colors hover:border-primary/40">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            </Card>
          );
          return href ? <Link key={label} href={href}>{body}</Link> : <div key={label}>{body}</div>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">Commercial priority is an internal sales signal and is never a statement about a website&apos;s security.</p>
    </div>
  );
}
