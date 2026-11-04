import type { CheckResult, Finding, TechnologyObservation } from "@/lib/scanner/types";
import type { ScoreSummary } from "@/lib/scoring/score";

export type AssessmentStatus = "queued" | "running" | "completed" | "failed";

export interface NewLeadRow {
  full_name: string;
  email: string;
  company: string;
  job_title: string | null;
  country: string;
  company_website: string | null;
  target_url: string;
  target_domain: string;
  website_name: string | null;
  platform: string | null;
  app_type: string | null;
  is_business: boolean | null;
  has_registration: boolean | null;
  has_login: boolean | null;
  processes_payments: boolean | null;
  stores_customer_data: boolean | null;
  uses_database: boolean | null;
  has_admin_dashboard: boolean | null;
  wants_remediation_help: boolean;
  authorization_confirmed: true;
  authorization_confirmed_at: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  lead_source: string;
  status: string;
  priority: "A" | "B" | "C";
  priority_score: number;
  submitter_ip_hash: string | null;
  is_test: boolean;
}

export interface ConsentRow {
  consent_type: "assessment_authorization" | "privacy_notice" | "marketing";
  granted: boolean;
  consent_text: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export interface CreateSubmissionInput {
  lead: NewLeadRow;
  assessment: { idempotency_key: string; target_url: string; target_domain: string; is_test: boolean };
  report: { report_number: string; token_hash: string; token_expires_at: string };
  consents: ConsentRow[];
}

export interface LeadRecord extends NewLeadRow {
  id: string;
  owner: string | null;
  sales_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentRecord {
  id: string;
  lead_id: string;
  idempotency_key: string;
  target_url: string;
  target_domain: string;
  final_url: string | null;
  status: AssessmentStatus;
  score: number | null;
  score_band: string | null;
  checks_performed: number;
  checks_passed: number;
  checks_attention: number;
  checks_unavailable: number;
  findings_count: number;
  findings_by_severity: Record<string, number>;
  category_scores: ScoreSummary["categories"];
  technologies: TechnologyObservation[];
  limitations: string[];
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  report_number: string;
  assessment_id: string;
  lead_id: string;
  token_hash: string;
  token_expires_at: string;
  revoked_at: string | null;
  status: "pending" | "ready" | "failed";
  generated_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
  pdf_downloads: number;
  created_at: string;
}

export interface CheckRecord {
  check_key: string;
  category: string;
  title: string;
  status: CheckResult["status"];
  max_points: number;
  earned_points: number;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface FindingRecord {
  finding_key: string;
  check_key: string;
  category: string;
  title: string;
  severity: Finding["severity"];
  observation: string;
  explanation: string;
  impact: string;
  remediation: string;
  evidence: Record<string, unknown>;
  confidence: Finding["confidence"];
  limitation: string;
}

export interface ReportBundle {
  report: ReportRecord;
  assessment: AssessmentRecord;
  lead: Pick<LeadRecord, "id" | "full_name" | "email" | "company" | "website_name" | "target_domain" | "status" | "priority" | "wants_remediation_help">;
  checks: CheckRecord[];
  findings: FindingRecord[];
}

export interface SaveScanInput {
  finalUrl: string | null;
  checks: CheckResult[];
  findings: Finding[];
  technologies: TechnologyObservation[];
  limitations: string[];
  summary: ScoreSummary;
  completedAt: string;
  durationMs: number;
}

export interface NewConsultationRow {
  full_name: string;
  email: string;
  company: string | null;
  website: string | null;
  service: string | null;
  message: string;
  source: string;
  lead_id: string | null;
  ip_hash: string | null;
}

/**
 * Persistence boundary for the public workflows. The production implementation uses the
 * Supabase service-role client; tests use an in-memory implementation.
 */
export interface Repository {
  findByIdempotencyKey(key: string): Promise<{ assessmentId: string; reportId: string; leadId: string } | null>;
  createSubmission(input: CreateSubmissionInput): Promise<{ leadId: string; assessmentId: string; reportId: string }>;
  rotateReportToken(reportId: string, tokenHash: string, expiresAt: string): Promise<void>;
  countRunningAssessments(staleBeforeIso: string): Promise<number>;
  /** Atomically moves queued (or stale running) → running. Returns null when not claimable. */
  claimAssessment(assessmentId: string, staleBeforeIso: string, maxAttempts: number): Promise<AssessmentRecord | null>;
  saveScanResult(assessmentId: string, input: SaveScanInput): Promise<void>;
  requeueOrFail(assessmentId: string, message: string, finalFailure: boolean): Promise<void>;
  setReportStatus(reportId: string, status: ReportRecord["status"], generatedAt?: string): Promise<void>;
  getLead(leadId: string): Promise<LeadRecord | null>;
  updateLead(leadId: string, patch: Partial<Pick<LeadRecord, "status" | "priority" | "priority_score">>): Promise<void>;
  getReportBundleByTokenHash(tokenHash: string): Promise<ReportBundle | null>;
  getReportBundleById(reportId: string): Promise<ReportBundle | null>;
  recordReportView(reportId: string): Promise<void>;
  recordPdfDownload(reportId: string): Promise<void>;
  findLatestLeadByEmail(email: string): Promise<LeadRecord | null>;
  createConsultation(row: NewConsultationRow): Promise<{ id: string }>;
  createDeletionRequest(row: { email: string; website: string | null; message: string | null; ip_hash: string | null }): Promise<{ id: string }>;
}
