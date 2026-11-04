import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import type {
  AssessmentRecord,
  CreateSubmissionInput,
  LeadRecord,
  ReportBundle,
  ReportRecord,
  Repository,
  SaveScanInput,
} from "./repository";

function must<T>(res: { data: T; error: { message: string; code?: string } | null }, context: string): T {
  if (res.error) {
    const err = new Error(`${context}: ${res.error.message}`) as Error & { code?: string };
    err.code = res.error.code;
    throw err;
  }
  return res.data;
}

const LEAD_PUBLIC_FIELDS = "id, full_name, email, company, website_name, target_domain, status, priority, wants_remediation_help";

export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient = createServiceClient()) {}

  async findByIdempotencyKey(key: string) {
    const row = must(
      await this.db.from("assessments").select("id, lead_id, reports(id)").eq("idempotency_key", key).maybeSingle(),
      "find idempotency",
    ) as { id: string; lead_id: string; reports: { id: string } | { id: string }[] | null } | null;
    if (!row) return null;
    const report = Array.isArray(row.reports) ? row.reports[0] : row.reports;
    if (!report) return null;
    return { assessmentId: row.id, leadId: row.lead_id, reportId: report.id };
  }

  async createSubmission(input: CreateSubmissionInput) {
    const lead = must(await this.db.from("leads").insert(input.lead).select("id").single(), "insert lead") as { id: string };
    try {
      const assessment = must(
        await this.db.from("assessments").insert({ ...input.assessment, lead_id: lead.id }).select("id").single(),
        "insert assessment",
      ) as { id: string };
      const report = must(
        await this.db.from("reports").insert({ ...input.report, assessment_id: assessment.id, lead_id: lead.id }).select("id").single(),
        "insert report",
      ) as { id: string };
      must(await this.db.from("consent_records").insert(input.consents.map((c) => ({ ...c, lead_id: lead.id }))), "insert consents");
      return { leadId: lead.id, assessmentId: assessment.id, reportId: report.id };
    } catch (e) {
      // Compensate: remove the partially created lead (cascades to children).
      await this.db.from("leads").delete().eq("id", lead.id);
      throw e;
    }
  }

  async rotateReportToken(reportId: string, tokenHash: string, expiresAt: string) {
    must(await this.db.from("reports").update({ token_hash: tokenHash, token_expires_at: expiresAt, revoked_at: null }).eq("id", reportId), "rotate token");
  }

  async countRunningAssessments(staleBeforeIso: string) {
    const res = await this.db.from("assessments").select("id", { count: "exact", head: true }).eq("status", "running").gt("started_at", staleBeforeIso);
    if (res.error) throw new Error("count running");
    return res.count ?? 0;
  }

  async claimAssessment(assessmentId: string, staleBeforeIso: string, maxAttempts: number) {
    const rows = must(
      await this.db.rpc("claim_assessment", { p_id: assessmentId, p_stale_before: staleBeforeIso, p_max_attempts: maxAttempts }),
      "claim",
    ) as AssessmentRecord[] | null;
    return rows?.[0] ?? null;
  }

  async saveScanResult(assessmentId: string, input: SaveScanInput) {
    must(await this.db.from("assessment_checks").delete().eq("assessment_id", assessmentId), "clear checks");
    must(await this.db.from("assessment_findings").delete().eq("assessment_id", assessmentId), "clear findings");
    if (input.checks.length) {
      must(
        await this.db.from("assessment_checks").insert(
          input.checks.map((c) => ({
            assessment_id: assessmentId,
            check_key: c.key,
            category: c.category,
            title: c.title,
            status: c.status,
            max_points: c.maxPoints,
            earned_points: c.earnedPoints,
            summary: c.summary,
            evidence: c.evidence,
          })),
        ),
        "insert checks",
      );
    }
    if (input.findings.length) {
      must(
        await this.db.from("assessment_findings").insert(
          input.findings.map((f) => ({
            assessment_id: assessmentId,
            finding_key: f.key,
            check_key: f.checkKey,
            category: f.category,
            title: f.title,
            severity: f.severity,
            observation: f.observation,
            explanation: f.explanation,
            impact: f.impact,
            remediation: f.remediation,
            evidence: f.evidence,
            confidence: f.confidence,
            limitation: f.limitation,
          })),
        ),
        "insert findings",
      );
    }
    const s = input.summary;
    must(
      await this.db
        .from("assessments")
        .update({
          status: "completed",
          final_url: input.finalUrl,
          score: s.score,
          score_band: s.band,
          checks_performed: s.checksPerformed,
          checks_passed: s.checksPassed,
          checks_attention: s.checksNeedingAttention,
          checks_unavailable: s.checksUnavailable,
          findings_count: input.findings.length,
          findings_by_severity: s.findingsBySeverity,
          category_scores: s.categories,
          technologies: input.technologies,
          limitations: input.limitations,
          completed_at: input.completedAt,
          duration_ms: input.durationMs,
          error_message: null,
        })
        .eq("id", assessmentId),
      "complete assessment",
    );
  }

  async requeueOrFail(assessmentId: string, message: string, finalFailure: boolean) {
    must(
      await this.db
        .from("assessments")
        .update({ status: finalFailure ? "failed" : "queued", error_message: message.slice(0, 500), ...(finalFailure ? { completed_at: new Date().toISOString() } : {}) })
        .eq("id", assessmentId),
      "fail assessment",
    );
  }

  async setReportStatus(reportId: string, status: ReportRecord["status"], generatedAt?: string) {
    must(await this.db.from("reports").update({ status, ...(generatedAt ? { generated_at: generatedAt } : {}) }).eq("id", reportId), "report status");
  }

  async getLead(leadId: string) {
    return must(await this.db.from("leads").select("*").eq("id", leadId).maybeSingle(), "get lead") as LeadRecord | null;
  }

  async updateLead(leadId: string, patch: Partial<Pick<LeadRecord, "status" | "priority" | "priority_score">>) {
    must(await this.db.from("leads").update(patch).eq("id", leadId), "update lead");
  }

  private async bundle(report: ReportRecord | null): Promise<ReportBundle | null> {
    if (!report) return null;
    const [assessment, lead, checks, findings] = await Promise.all([
      this.db.from("assessments").select("*").eq("id", report.assessment_id).single(),
      this.db.from("leads").select(LEAD_PUBLIC_FIELDS).eq("id", report.lead_id).single(),
      this.db.from("assessment_checks").select("check_key, category, title, status, max_points, earned_points, summary, evidence").eq("assessment_id", report.assessment_id),
      this.db
        .from("assessment_findings")
        .select("finding_key, check_key, category, title, severity, observation, explanation, impact, remediation, evidence, confidence, limitation")
        .eq("assessment_id", report.assessment_id),
    ]);
    if (assessment.error || lead.error) return null;
    return {
      report,
      assessment: assessment.data as AssessmentRecord,
      lead: lead.data as ReportBundle["lead"],
      checks: ((checks.data ?? []) as ReportBundle["checks"]).map((c) => ({ ...c, max_points: Number(c.max_points), earned_points: Number(c.earned_points) })),
      findings: (findings.data ?? []) as ReportBundle["findings"],
    };
  }

  async getReportBundleByTokenHash(tokenHash: string) {
    const report = must(await this.db.from("reports").select("*").eq("token_hash", tokenHash).maybeSingle(), "report by token") as ReportRecord | null;
    return this.bundle(report);
  }

  async getReportBundleById(reportId: string) {
    const report = must(await this.db.from("reports").select("*").eq("id", reportId).maybeSingle(), "report by id") as ReportRecord | null;
    return this.bundle(report);
  }

  async recordReportView(reportId: string) {
    await this.db.rpc("record_report_event", { p_report_id: reportId, p_kind: "view" });
  }

  async recordPdfDownload(reportId: string) {
    await this.db.rpc("record_report_event", { p_report_id: reportId, p_kind: "pdf" });
  }

  async findLatestLeadByEmail(email: string) {
    const rows = must(
      await this.db.from("leads").select("*").ilike("email", email.replace(/[%_]/g, "\\$&")).order("created_at", { ascending: false }).limit(1),
      "lead by email",
    ) as LeadRecord[];
    return rows[0] ?? null;
  }

  async createConsultation(row: Parameters<Repository["createConsultation"]>[0]) {
    return must(await this.db.from("consultation_requests").insert(row).select("id").single(), "insert consultation") as { id: string };
  }

  async createDeletionRequest(row: Parameters<Repository["createDeletionRequest"]>[0]) {
    return must(await this.db.from("data_deletion_requests").insert(row).select("id").single(), "insert deletion request") as { id: string };
  }
}
