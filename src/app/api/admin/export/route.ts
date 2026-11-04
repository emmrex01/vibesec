import { listLeads, toCsv } from "@/lib/admin/queries";
import { requireAdminApi } from "@/lib/auth/admin";
import { handleError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "id", label: "Lead ID" },
  { key: "created_at", label: "Submitted" },
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "country", label: "Country" },
  { key: "target_url", label: "Website" },
  { key: "platform", label: "Platform" },
  { key: "app_type", label: "Application type" },
  { key: "score", label: "Assessment score" },
  { key: "findings", label: "Findings" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "wants_remediation_help", label: "Wants remediation help" },
  { key: "marketing_consent", label: "Marketing consent" },
];

export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  try {
    const p = new URL(req.url).searchParams;
    const { rows } = await listLeads(
      {
        q: p.get("q") ?? undefined,
        status: p.get("status") ?? undefined,
        priority: p.get("priority") ?? undefined,
        country: p.get("country") ?? undefined,
        platform: p.get("platform") ?? undefined,
        from: p.get("from") ?? undefined,
        to: p.get("to") ?? undefined,
        result: p.get("result") ?? undefined,
      },
      { all: true },
    );
    const flat = rows.map((r) => ({ ...r, score: r.assessments?.[0]?.score ?? "", findings: r.assessments?.[0]?.findings_count ?? "" }));
    const csv = toCsv(flat, COLUMNS);
    console.info(`[admin/export] ${admin.email} exported ${rows.length} leads`);
    return new Response(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vibesec-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e, "admin/export");
  }
}
