import type { SiteSettings } from "@/config/defaults";
import { adminLeadEmail, assessmentCompletedEmail, assessmentReceivedEmail, consultationAdminEmail } from "@/lib/email/templates";
import type { Mailer } from "@/lib/email";
import { LIMITS, type RateLimiter } from "@/lib/rate-limit";
import { ScanTargetError } from "@/lib/scanner";
import type { ScanResult } from "@/lib/scanner/types";
import { scoreLead } from "@/lib/scoring/lead-priority";
import { calculateScore } from "@/lib/scoring/score";
import { generateReportNumber, generateReportToken, hashIp, hashToken, isWellFormedToken } from "@/lib/security/tokens";
import { validateTargetUrl } from "@/lib/security/url";
import {
  AUTHORIZATION_TEXT,
  MARKETING_TEXT,
  PRIVACY_NOTICE_TEXT,
  triToBool,
  type AssessmentSubmission,
  type ConsultationInput,
} from "@/lib/validation/schemas";
import type { ReportBundle, Repository } from "./repository";

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "ServiceError";
  }
}

export interface ServiceDeps {
  repo: Repository;
  limiter: RateLimiter;
  mailer: Mailer;
  scanner: (url: string) => Promise<ScanResult>;
  now: () => Date;
  settings: SiteSettings;
  siteUrl: string;
  adminEmail: string | null;
  ipSalt: string;
  maxConcurrentScans: number;
  tokenTtlDays: number;
  isTest?: boolean;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

const STALE_RUNNING_MS = 3 * 60_000;
const MAX_ATTEMPTS = 3;

export const reportUrlFor = (siteUrl: string, token: string) => `${siteUrl}/report/${token}`;

async function enforce(limiter: RateLimiter, key: string, rule: { max: number; windowSeconds: number }, message: string) {
  if (!(await limiter.limit(key, rule.max, rule.windowSeconds))) throw new ServiceError(429, "rate_limited", message);
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------
export async function submitAssessment(
  input: AssessmentSubmission,
  ctx: RequestContext,
  deps: ServiceDeps,
): Promise<{ reportToken: string; reportNumber: string | null; assessmentId: string; created: boolean }> {
  const target = validateTargetUrl(input.websiteUrl);
  if (!target.ok) throw new ServiceError(400, "invalid_url", target.message);
  if (input.authorizationConfirmed !== true) throw new ServiceError(400, "authorization_required", "Authorization confirmation is required.");

  const now = deps.now();
  const expiresAt = new Date(now.getTime() + deps.tokenTtlDays * 86_400_000).toISOString();
  const ipHash = hashIp(ctx.ip, deps.ipSalt);

  // Idempotency: a retried submission returns the original assessment with a freshly rotated token.
  const existing = await deps.repo.findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    const token = generateReportToken();
    await deps.repo.rotateReportToken(existing.reportId, hashToken(token), expiresAt);
    return { reportToken: token, reportNumber: null, assessmentId: existing.assessmentId, created: false };
  }

  await enforce(deps.limiter, "submit:global", LIMITS.submitGlobalPerMinute, "We're receiving a lot of requests right now. Please try again in a minute.");
  await enforce(deps.limiter, `submit:ip:${ipHash ?? "unknown"}`, LIMITS.submitPerIp, "Too many assessment requests from your network. Please try again later.");
  await enforce(deps.limiter, `submit:domain:${target.registrableDomain}`, LIMITS.submitPerDomain, "This domain has been assessed several times recently. Please try again tomorrow.");

  const isBusiness = input.appType ? input.appType === "business_application" || input.appType === "business_website" : null;
  const lead = scoreLead({
    isBusiness,
    hasRegistration: triToBool(input.hasRegistration),
    hasLogin: triToBool(input.hasLogin),
    processesPayments: triToBool(input.processesPayments),
    storesCustomerData: triToBool(input.storesCustomerData),
    usesDatabase: triToBool(input.usesDatabase),
    hasAdminDashboard: triToBool(input.hasAdminDashboard),
    platform: input.platform ?? null,
    email: input.email,
    wantsRemediationHelp: !!input.wantsRemediationHelp,
    consultationRequested: false,
  });

  const token = generateReportToken();
  const reportNumber = generateReportNumber(now);
  const nowIso = now.toISOString();
  const userAgent = ctx.userAgent?.slice(0, 300) ?? null;
  const marketing = input.marketingConsent === true;
  const companyWebsite = input.companyWebsite ? validateTargetUrl(input.companyWebsite) : null;

  let created;
  try {
    created = await deps.repo.createSubmission({
      lead: {
        full_name: input.fullName,
        email: input.email.toLowerCase(),
        company: input.company,
        job_title: input.jobTitle || null,
        country: input.country,
        company_website: companyWebsite?.ok ? companyWebsite.url.toString() : null,
        target_url: target.url.toString(),
        target_domain: target.hostname,
        website_name: input.websiteName || null,
        platform: input.platform ?? null,
        app_type: input.appType ?? null,
        is_business: isBusiness,
        has_registration: triToBool(input.hasRegistration),
        has_login: triToBool(input.hasLogin),
        processes_payments: triToBool(input.processesPayments),
        stores_customer_data: triToBool(input.storesCustomerData),
        uses_database: triToBool(input.usesDatabase),
        has_admin_dashboard: triToBool(input.hasAdminDashboard),
        wants_remediation_help: !!input.wantsRemediationHelp,
        authorization_confirmed: true,
        authorization_confirmed_at: nowIso,
        marketing_consent: marketing,
        marketing_consent_at: marketing ? nowIso : null,
        lead_source: "security_health_check",
        status: "assessment_started",
        priority: lead.priority,
        priority_score: lead.score,
        submitter_ip_hash: ipHash,
        is_test: !!deps.isTest,
      },
      assessment: { idempotency_key: input.idempotencyKey, target_url: target.url.toString(), target_domain: target.hostname, is_test: !!deps.isTest },
      report: { report_number: reportNumber, token_hash: hashToken(token), token_expires_at: expiresAt },
      consents: [
        { consent_type: "assessment_authorization", granted: true, consent_text: AUTHORIZATION_TEXT, ip_hash: ipHash, user_agent: userAgent },
        { consent_type: "privacy_notice", granted: true, consent_text: PRIVACY_NOTICE_TEXT, ip_hash: ipHash, user_agent: userAgent },
        { consent_type: "marketing", granted: marketing, consent_text: MARKETING_TEXT, ip_hash: ipHash, user_agent: userAgent },
      ],
    });
  } catch (e) {
    // Lost an idempotency race: return the winner.
    if ((e as { code?: string }).code === "23505") {
      const winner = await deps.repo.findByIdempotencyKey(input.idempotencyKey);
      if (winner) {
        await deps.repo.rotateReportToken(winner.reportId, hashToken(token), expiresAt);
        return { reportToken: token, reportNumber: null, assessmentId: winner.assessmentId, created: false };
      }
    }
    throw e;
  }

  const mail = assessmentReceivedEmail({
    businessName: deps.settings.businessName,
    name: input.fullName,
    domain: target.hostname,
    reportUrl: reportUrlFor(deps.siteUrl, token),
  });
  await deps.mailer.send({ to: input.email, ...mail });

  return { reportToken: token, reportNumber, assessmentId: created.assessmentId, created: true };
}

// ---------------------------------------------------------------------------
// Report access (token is the capability)
// ---------------------------------------------------------------------------
export async function loadBundleForToken(token: string | null | undefined, deps: Pick<ServiceDeps, "repo" | "now">): Promise<ReportBundle> {
  if (!isWellFormedToken(token)) throw new ServiceError(404, "not_found", "Report not found.");
  const bundle = await deps.repo.getReportBundleByTokenHash(hashToken(token));
  if (!bundle) throw new ServiceError(404, "not_found", "Report not found.");
  if (bundle.report.revoked_at) throw new ServiceError(410, "revoked", "This report link has been revoked.");
  if (new Date(bundle.report.token_expires_at).getTime() < deps.now().getTime()) {
    throw new ServiceError(410, "expired", "This report link has expired. Please request a new assessment.");
  }
  return bundle;
}

// ---------------------------------------------------------------------------
// Running the scan
// ---------------------------------------------------------------------------
export async function runAssessmentForBundle(bundle: ReportBundle, reportToken: string | null, deps: ServiceDeps): Promise<{ status: string }> {
  const now = deps.now();
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS).toISOString();
  if (bundle.assessment.status === "completed" || bundle.assessment.status === "failed") return { status: bundle.assessment.status };

  if ((await deps.repo.countRunningAssessments(staleBefore)) >= deps.maxConcurrentScans) return { status: "queued" };

  const claimed = await deps.repo.claimAssessment(bundle.assessment.id, staleBefore, MAX_ATTEMPTS);
  if (!claimed) return { status: bundle.assessment.status === "queued" ? "running" : bundle.assessment.status };

  let scan: ScanResult;
  try {
    scan = await deps.scanner(claimed.target_url);
  } catch (e) {
    const target = e instanceof ScanTargetError;
    const finalFailure = target || claimed.attempts >= MAX_ATTEMPTS;
    const message = target ? e.publicMessage : "The assessment could not be completed due to a temporary problem.";
    await deps.repo.requeueOrFail(claimed.id, message, finalFailure);
    if (finalFailure) await deps.repo.setReportStatus(bundle.report.id, "failed");
    if (!target) console.error("[assessment] scan error", (e as Error)?.name);
    return { status: finalFailure ? "failed" : "queued" };
  }

  const summary = calculateScore(scan.checks, scan.findings);
  await deps.repo.saveScanResult(claimed.id, {
    finalUrl: scan.finalUrl,
    checks: scan.checks,
    findings: scan.findings,
    technologies: scan.technologies,
    limitations: scan.limitations,
    summary,
    completedAt: scan.completedAt,
    durationMs: scan.durationMs,
  });
  await deps.repo.setReportStatus(bundle.report.id, "ready", deps.now().toISOString());

  const lead = await deps.repo.getLead(claimed.lead_id);
  if (lead) {
    const q = scoreLead({
      isBusiness: lead.is_business,
      hasRegistration: lead.has_registration,
      hasLogin: lead.has_login,
      processesPayments: lead.processes_payments,
      storesCustomerData: lead.stores_customer_data,
      usesDatabase: lead.uses_database,
      hasAdminDashboard: lead.has_admin_dashboard,
      platform: lead.platform,
      email: lead.email,
      wantsRemediationHelp: lead.wants_remediation_help,
      consultationRequested: false,
      findingsBySeverity: summary.findingsBySeverity,
    });
    const advanceStatus = ["new", "assessment_started"].includes(lead.status) ? { status: "assessment_completed" } : {};
    // Never downgrade a priority that was raised by a later consultation request.
    const priority = lead.priority < q.priority ? lead.priority : q.priority;
    await deps.repo.updateLead(lead.id, { ...advanceStatus, priority, priority_score: Math.max(lead.priority_score, q.score) });

    if (reportToken) {
      const mail = assessmentCompletedEmail({
        businessName: deps.settings.businessName,
        name: lead.full_name,
        domain: lead.target_domain,
        reportUrl: reportUrlFor(deps.siteUrl, reportToken),
        score: summary.score,
      });
      await deps.mailer.send({ to: lead.email, ...mail });
    }
    if (deps.adminEmail && priority !== "C") {
      const mail = adminLeadEmail({
        businessName: deps.settings.businessName,
        name: lead.full_name,
        company: lead.company,
        domain: lead.target_domain,
        priority,
        score: summary.score,
        adminUrl: `${deps.siteUrl}/admin/leads/${lead.id}`,
      });
      await deps.mailer.send({ to: deps.adminEmail, ...mail });
    }
  }
  return { status: "completed" };
}

export async function runAssessmentByToken(token: string, deps: ServiceDeps) {
  const bundle = await loadBundleForToken(token, deps);
  return runAssessmentForBundle(bundle, token, deps);
}

export function publicStatus(bundle: ReportBundle) {
  return {
    status: bundle.assessment.status,
    reportNumber: bundle.report.report_number,
    domain: bundle.assessment.target_domain,
    score: bundle.assessment.status === "completed" ? bundle.assessment.score : null,
    message: bundle.assessment.status === "failed" ? bundle.assessment.error_message : null,
  };
}

// ---------------------------------------------------------------------------
// Consultation & deletion requests
// ---------------------------------------------------------------------------
export async function submitConsultation(input: ConsultationInput, ctx: RequestContext, deps: ServiceDeps) {
  const ipHash = hashIp(ctx.ip, deps.ipSalt);
  await enforce(deps.limiter, `contact:ip:${ipHash ?? "unknown"}`, LIMITS.contactPerIp, "Too many requests. Please try again later or email us directly.");

  const lead = await deps.repo.findLatestLeadByEmail(input.email);
  const website = input.website ? validateTargetUrl(input.website) : null;
  const created = await deps.repo.createConsultation({
    full_name: input.fullName,
    email: input.email,
    company: input.company || null,
    website: website?.ok ? website.url.toString() : null,
    service: input.service ?? null,
    message: input.message,
    source: input.source ?? "contact_page",
    lead_id: lead?.id ?? null,
    ip_hash: ipHash,
  });

  if (lead) {
    const q = scoreLead({
      isBusiness: lead.is_business,
      hasRegistration: lead.has_registration,
      hasLogin: lead.has_login,
      processesPayments: lead.processes_payments,
      storesCustomerData: lead.stores_customer_data,
      usesDatabase: lead.uses_database,
      hasAdminDashboard: lead.has_admin_dashboard,
      platform: lead.platform,
      email: lead.email,
      wantsRemediationHelp: lead.wants_remediation_help,
      consultationRequested: true,
    });
    const priority = lead.priority < q.priority ? lead.priority : q.priority;
    const status = ["new", "assessment_started", "assessment_completed", "report_viewed"].includes(lead.status) ? "interested" : lead.status;
    await deps.repo.updateLead(lead.id, { priority, priority_score: Math.max(lead.priority_score, q.score), status });
  }

  if (deps.adminEmail) {
    const mail = consultationAdminEmail({
      businessName: deps.settings.businessName,
      name: input.fullName,
      email: input.email,
      company: input.company,
      website: input.website,
      service: input.service,
      message: input.message,
      adminUrl: `${deps.siteUrl}/admin/consultations`,
    });
    await deps.mailer.send({ to: deps.adminEmail, ...mail });
  }
  return created;
}

export async function submitDeletionRequest(
  input: { email: string; website?: string; message?: string },
  ctx: RequestContext,
  deps: Pick<ServiceDeps, "repo" | "limiter" | "ipSalt">,
) {
  const ipHash = hashIp(ctx.ip, deps.ipSalt);
  await enforce(deps.limiter, `deletion:ip:${ipHash ?? "unknown"}`, LIMITS.deletionPerIp, "Too many requests. Please try again later.");
  return deps.repo.createDeletionRequest({ email: input.email, website: input.website || null, message: input.message || null, ip_hash: ipHash });
}
