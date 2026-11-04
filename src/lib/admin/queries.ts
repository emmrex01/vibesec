import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { LEAD_STATUSES } from "@/lib/validation/schemas";

/** All functions here run with the service role and MUST only be called after requireAdmin*(). */

export interface LeadFilters {
  q?: string;
  status?: string;
  priority?: string;
  country?: string;
  platform?: string;
  from?: string;
  to?: string;
  result?: string; // score band
  page?: number;
}

export const PAGE_SIZE = 25;

/** Keeps only characters that are safe inside a PostgREST filter expression. */
export function sanitizeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 80);
}

function isoDate(v: string | undefined, endOfDay = false): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return `${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

const BAND_RANGES: Record<string, [number, number]> = {
  good: [80, 100],
  improvement: [60, 79],
  several: [40, 59],
  significant: [0, 39],
};

export interface LeadRow {
  id: string;
  full_name: string;
  company: string;
  email: string;
  target_domain: string;
  target_url: string;
  country: string;
  platform: string | null;
  priority: string;
  priority_score: number;
  status: string;
  owner: string | null;
  marketing_consent: boolean;
  created_at: string;
  assessments: { id: string; score: number | null; status: string; findings_count: number }[];
}

export async function listLeads(f: LeadFilters, opts: { all?: boolean } = {}) {
  const db = createServiceClient();
  const joinMode = f.result && BAND_RANGES[f.result] ? "assessments!inner" : "assessments";
  let query = db
    .from("leads")
    .select(
      `id, full_name, company, email, target_domain, target_url, country, platform, priority, priority_score, status, owner, marketing_consent, created_at, job_title, app_type, wants_remediation_help, ${joinMode}(id, score, status, findings_count)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  const q = sanitizeSearch(f.q);
  if (q) query = query.or(`email.ilike.%${q}%,target_domain.ilike.%${q}%,company.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (f.status && (LEAD_STATUSES as readonly string[]).includes(f.status)) query = query.eq("status", f.status);
  if (f.priority && ["A", "B", "C"].includes(f.priority)) query = query.eq("priority", f.priority);
  if (f.country) query = query.eq("country", f.country.slice(0, 80));
  if (f.platform) query = query.eq("platform", f.platform.slice(0, 20));
  const from = isoDate(f.from);
  const to = isoDate(f.to, true);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (f.result && BAND_RANGES[f.result]) {
    const [lo, hi] = BAND_RANGES[f.result];
    query = query.gte("assessments.score", lo).lte("assessments.score", hi);
  }

  if (opts.all) query = query.limit(10_000);
  else {
    const page = Math.max(1, f.page ?? 1);
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }
  const { data, count, error } = await query;
  if (error) throw new Error("listLeads failed");
  return { rows: (data ?? []) as unknown as (LeadRow & Record<string, unknown>)[], total: count ?? 0 };
}

export async function getLeadDetail(id: string) {
  const db = createServiceClient();
  const [lead, assessments, notes, consents, consultations] = await Promise.all([
    db.from("leads").select("*").eq("id", id).maybeSingle(),
    db.from("assessments").select("id, status, score, score_band, findings_count, findings_by_severity, created_at, completed_at, reports(id, report_number, status, view_count, pdf_downloads, revoked_at, token_expires_at)").eq("lead_id", id).order("created_at", { ascending: false }),
    db.from("admin_notes").select("id, body, author_email, created_at").eq("lead_id", id).order("created_at", { ascending: false }),
    db.from("consent_records").select("consent_type, granted, consent_text, created_at").eq("lead_id", id).order("created_at"),
    db.from("consultation_requests").select("id, service, message, status, created_at").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  if (!lead.data) return null;
  return { lead: lead.data, assessments: assessments.data ?? [], notes: notes.data ?? [], consents: consents.data ?? [], consultations: consultations.data ?? [] };
}

export async function listAssessments(page = 1, status?: string) {
  const db = createServiceClient();
  let q = db
    .from("assessments")
    .select("id, target_domain, status, score, findings_count, created_at, completed_at, lead_id, leads(full_name, company, email), reports(id, report_number, status)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && ["queued", "running", "completed", "failed"].includes(status)) q = q.eq("status", status);
  const { data, count, error } = await q;
  if (error) throw new Error("listAssessments failed");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getAssessmentDetail(id: string) {
  const db = createServiceClient();
  const [a, checks, findings] = await Promise.all([
    db.from("assessments").select("*, leads(id, full_name, company, email), reports(id, report_number, status, view_count, pdf_downloads, revoked_at, token_expires_at)").eq("id", id).maybeSingle(),
    db.from("assessment_checks").select("*").eq("assessment_id", id).order("category"),
    db.from("assessment_findings").select("*").eq("assessment_id", id),
  ]);
  if (!a.data) return null;
  return { assessment: a.data, checks: checks.data ?? [], findings: findings.data ?? [] };
}

export async function listReports(page = 1) {
  const db = createServiceClient();
  const { data, count, error } = await db
    .from("reports")
    .select("id, report_number, status, view_count, pdf_downloads, generated_at, revoked_at, token_expires_at, created_at, lead_id, assessment_id, leads(full_name, company), assessments(target_domain, score)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("listReports failed");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listConsultations(page = 1) {
  const db = createServiceClient();
  const { data, count, error } = await db
    .from("consultation_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("listConsultations failed");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listDeletionRequests() {
  const db = createServiceClient();
  const { data } = await db.from("data_deletion_requests").select("*").order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}

export async function overviewStats(fromDate?: string, toDate?: string) {
  const db = createServiceClient();
  const from = isoDate(fromDate);
  const to = isoDate(toDate, true);
  const lo = from ?? "1970-01-01T00:00:00.000Z";
  const hi = to ?? "9999-12-31T23:59:59.999Z";

  const count = async (table: string, eq?: [string, string]) => {
    let q = db.from(table).select("id", { count: "exact", head: true }).gte("created_at", lo).lte("created_at", hi);
    if (eq) q = q.eq(eq[0], eq[1]);
    const { count: c } = await q;
    return c ?? 0;
  };

  const [totalLeads, totalAssessments, completed, priorityA, priorityB, reportsReady, consultations, converted, scores] = await Promise.all([
    count("leads"),
    count("assessments"),
    count("assessments", ["status", "completed"]),
    count("leads", ["priority", "A"]),
    count("leads", ["priority", "B"]),
    count("reports", ["status", "ready"]),
    count("consultation_requests"),
    count("leads", ["status", "converted"]),
    db.from("assessments").select("score").eq("status", "completed").not("score", "is", null).gte("created_at", lo).lte("created_at", hi).limit(5000),
  ]);
  const values = ((scores.data ?? []) as { score: number }[]).map((s) => s.score);
  const averageScore = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return { totalLeads, totalAssessments, completed, averageScore, priorityA, priorityB, reportsReady, consultations, converted };
}

/** CSV with formula-injection protection. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(","))].join("\r\n");
}
