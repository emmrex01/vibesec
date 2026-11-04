import { randomUUID } from "node:crypto";
import type {
  AssessmentRecord,
  CheckRecord,
  CreateSubmissionInput,
  FindingRecord,
  LeadRecord,
  NewConsultationRow,
  ReportBundle,
  ReportRecord,
  Repository,
  SaveScanInput,
} from "@/lib/services/repository";
import type { ServiceDeps } from "@/lib/services/assessment-service";
import { defaultSettings } from "@/config/defaults";
import { MemoryRateLimiter } from "@/lib/rate-limit";
import type { EmailMessage, Mailer } from "@/lib/email";
import type { ScanResult } from "@/lib/scanner/types";

/** In-memory Repository mirroring the Supabase implementation's semantics (incl. unique idempotency keys). */
export class MemoryRepository implements Repository {
  leads = new Map<string, LeadRecord>();
  assessments = new Map<string, AssessmentRecord>();
  reports = new Map<string, ReportRecord>();
  checks = new Map<string, CheckRecord[]>();
  findings = new Map<string, FindingRecord[]>();
  consents: (CreateSubmissionInput["consents"][number] & { lead_id: string })[] = [];
  consultations: (NewConsultationRow & { id: string })[] = [];
  deletionRequests: { id: string; email: string }[] = [];

  async findByIdempotencyKey(key: string) {
    const a = [...this.assessments.values()].find((x) => x.idempotency_key === key);
    if (!a) return null;
    const r = [...this.reports.values()].find((x) => x.assessment_id === a.id)!;
    return { assessmentId: a.id, leadId: a.lead_id, reportId: r.id };
  }

  async createSubmission(input: CreateSubmissionInput) {
    if ([...this.assessments.values()].some((a) => a.idempotency_key === input.assessment.idempotency_key)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    const now = new Date().toISOString();
    const leadId = randomUUID();
    this.leads.set(leadId, { ...input.lead, id: leadId, owner: null, sales_notes: null, created_at: now, updated_at: now });
    const assessmentId = randomUUID();
    this.assessments.set(assessmentId, {
      id: assessmentId,
      lead_id: leadId,
      idempotency_key: input.assessment.idempotency_key,
      target_url: input.assessment.target_url,
      target_domain: input.assessment.target_domain,
      final_url: null,
      status: "queued",
      score: null,
      score_band: null,
      checks_performed: 0,
      checks_passed: 0,
      checks_attention: 0,
      checks_unavailable: 0,
      findings_count: 0,
      findings_by_severity: {},
      category_scores: [],
      technologies: [],
      limitations: [],
      error_message: null,
      attempts: 0,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      created_at: now,
    });
    const reportId = randomUUID();
    this.reports.set(reportId, {
      id: reportId,
      report_number: input.report.report_number,
      assessment_id: assessmentId,
      lead_id: leadId,
      token_hash: input.report.token_hash,
      token_expires_at: input.report.token_expires_at,
      revoked_at: null,
      status: "pending",
      generated_at: null,
      first_viewed_at: null,
      view_count: 0,
      pdf_downloads: 0,
      created_at: now,
    });
    for (const c of input.consents) this.consents.push({ ...c, lead_id: leadId });
    return { leadId, assessmentId, reportId };
  }

  async rotateReportToken(reportId: string, tokenHash: string, expiresAt: string) {
    const r = this.reports.get(reportId)!;
    this.reports.set(reportId, { ...r, token_hash: tokenHash, token_expires_at: expiresAt, revoked_at: null });
  }

  async countRunningAssessments(staleBeforeIso: string) {
    return [...this.assessments.values()].filter((a) => a.status === "running" && (a.started_at ?? "") > staleBeforeIso).length;
  }

  async claimAssessment(id: string, staleBeforeIso: string, maxAttempts: number) {
    const a = this.assessments.get(id);
    if (!a || a.attempts >= maxAttempts) return null;
    const claimable = a.status === "queued" || (a.status === "running" && (a.started_at ?? "") < staleBeforeIso);
    if (!claimable) return null;
    const next = { ...a, status: "running" as const, started_at: new Date().toISOString(), attempts: a.attempts + 1, error_message: null };
    this.assessments.set(id, next);
    return next;
  }

  async saveScanResult(id: string, input: SaveScanInput) {
    this.checks.set(
      id,
      input.checks.map((c) => ({ check_key: c.key, category: c.category, title: c.title, status: c.status, max_points: c.maxPoints, earned_points: c.earnedPoints, summary: c.summary, evidence: c.evidence })),
    );
    this.findings.set(
      id,
      input.findings.map((f) => ({ finding_key: f.key, check_key: f.checkKey, category: f.category, title: f.title, severity: f.severity, observation: f.observation, explanation: f.explanation, impact: f.impact, remediation: f.remediation, evidence: f.evidence, confidence: f.confidence, limitation: f.limitation })),
    );
    const a = this.assessments.get(id)!;
    const s = input.summary;
    this.assessments.set(id, {
      ...a,
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
    });
  }

  async requeueOrFail(id: string, message: string, finalFailure: boolean) {
    const a = this.assessments.get(id)!;
    this.assessments.set(id, { ...a, status: finalFailure ? "failed" : "queued", error_message: message });
  }

  async setReportStatus(id: string, status: ReportRecord["status"], generatedAt?: string) {
    const r = this.reports.get(id)!;
    this.reports.set(id, { ...r, status, generated_at: generatedAt ?? r.generated_at });
  }

  async getLead(id: string) {
    return this.leads.get(id) ?? null;
  }

  async updateLead(id: string, patch: Partial<LeadRecord>) {
    const l = this.leads.get(id)!;
    this.leads.set(id, { ...l, ...patch });
  }

  private bundle(r: ReportRecord | undefined): ReportBundle | null {
    if (!r) return null;
    const lead = this.leads.get(r.lead_id)!;
    return {
      report: r,
      assessment: this.assessments.get(r.assessment_id)!,
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        company: lead.company,
        website_name: lead.website_name,
        target_domain: lead.target_domain,
        status: lead.status,
        priority: lead.priority,
        wants_remediation_help: lead.wants_remediation_help,
      },
      checks: this.checks.get(r.assessment_id) ?? [],
      findings: this.findings.get(r.assessment_id) ?? [],
    };
  }

  async getReportBundleByTokenHash(hash: string) {
    return this.bundle([...this.reports.values()].find((r) => r.token_hash === hash));
  }
  async getReportBundleById(id: string) {
    return this.bundle(this.reports.get(id));
  }
  async recordReportView(id: string) {
    const r = this.reports.get(id)!;
    this.reports.set(id, { ...r, view_count: r.view_count + 1, first_viewed_at: r.first_viewed_at ?? new Date().toISOString() });
  }
  async recordPdfDownload(id: string) {
    const r = this.reports.get(id)!;
    this.reports.set(id, { ...r, pdf_downloads: r.pdf_downloads + 1 });
  }
  async findLatestLeadByEmail(email: string) {
    return [...this.leads.values()].filter((l) => l.email.toLowerCase() === email.toLowerCase()).at(-1) ?? null;
  }
  async createConsultation(row: NewConsultationRow) {
    const id = randomUUID();
    this.consultations.push({ ...row, id });
    return { id };
  }
  async createDeletionRequest(row: { email: string }) {
    const id = randomUUID();
    this.deletionRequests.push({ id, email: row.email });
    return { id };
  }
}

export class RecordingMailer implements Mailer {
  sent: EmailMessage[] = [];
  async send(m: EmailMessage) {
    this.sent.push(m);
    return true;
  }
}

export function makeServiceDeps(over: Partial<ServiceDeps> & { scan?: ScanResult | Error } = {}) {
  const repo = (over.repo as MemoryRepository) ?? new MemoryRepository();
  const mailer = (over.mailer as RecordingMailer) ?? new RecordingMailer();
  let scannerCalls = 0;
  const deps: ServiceDeps = {
    repo,
    limiter: over.limiter ?? new MemoryRateLimiter(),
    mailer,
    scanner:
      over.scanner ??
      (async () => {
        scannerCalls++;
        if (over.scan instanceof Error) throw over.scan;
        if (!over.scan) throw new Error("no scan configured");
        return over.scan;
      }),
    now: over.now ?? (() => new Date()),
    settings: over.settings ?? defaultSettings(),
    siteUrl: "https://health.vibesec.test",
    adminEmail: over.adminEmail === undefined ? "sales@vibesec.test" : over.adminEmail,
    ipSalt: "test-salt",
    maxConcurrentScans: over.maxConcurrentScans ?? 10,
    tokenTtlDays: over.tokenTtlDays ?? 90,
    isTest: true,
  };
  return { deps, repo, mailer, scannerCalls: () => scannerCalls };
}

export const VALID_SUBMISSION = {
  websiteUrl: "https://example.com",
  websiteName: "Example App",
  platform: "lovable" as const,
  fullName: "Ada Founder",
  email: "ada@examplecorp.com",
  company: "Example Corp",
  jobTitle: "CEO",
  country: "United Kingdom",
  companyWebsite: "",
  appType: "business_application",
  hasRegistration: "yes" as const,
  hasLogin: "yes" as const,
  processesPayments: "yes" as const,
  storesCustomerData: "yes" as const,
  usesDatabase: "yes" as const,
  hasAdminDashboard: "no" as const,
  wantsRemediationHelp: false,
  authorizationConfirmed: true as const,
  marketingConsent: false,
  idempotencyKey: "test-key-0123456789abcdef",
};
