import { BAND_LABELS, SCORE_DISCLAIMER, type ScoreBand } from "@/lib/scoring/score";
import { CATEGORY_LABELS, SEVERITY_ORDER, type CheckCategory, type Severity, type TechnologyObservation } from "@/lib/scanner/types";
import type { CheckRecord, FindingRecord, ReportBundle } from "@/lib/services/repository";

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export const STATUS_LABELS: Record<CheckRecord["status"], string> = {
  pass: "Passed",
  warn: "Needs attention",
  fail: "Needs attention",
  info: "Informational",
  unavailable: "Unavailable",
  not_applicable: "Not applicable",
};

/** General good-practice guidance, always shown separately from confirmed findings. */
export const GENERAL_RECOMMENDATIONS = [
  "Review who can read and write each database table. For Supabase projects, enable Row Level Security on every table and test policies with real user roles.",
  "Keep secrets (API keys, service-role keys, webhook secrets) on the server only, and rotate any that may have been exposed in client code or repositories.",
  "Verify payment and other webhooks using the provider's signature, and never trust prices or user IDs sent from the browser.",
  "Apply rate limiting and bot protection to login, sign-up, password reset and other public forms.",
  "Keep frameworks and dependencies up to date, and enable automated dependency alerts.",
  "Commission an authorised manual assessment before scaling, raising funding or handling sensitive data.",
];

export interface ReportViewModel {
  reportNumber: string;
  domain: string;
  websiteName: string | null;
  companyName: string;
  assessmentDate: string | null;
  status: ReportBundle["assessment"]["status"];
  score: number | null;
  band: ScoreBand | null;
  bandLabel: string | null;
  disclaimer: string;
  summaryText: string;
  counts: { performed: number; passed: number; attention: number; unavailable: number; findings: number };
  findingsBySeverity: Record<Severity, number>;
  findings: FindingRecord[];
  checksByCategory: { category: CheckCategory; label: string; checks: CheckRecord[] }[];
  technologies: TechnologyObservation[];
  limitations: string[];
  generalRecommendations: string[];
}

export function buildReportViewModel(bundle: ReportBundle): ReportViewModel {
  const a = bundle.assessment;
  const band = (a.score_band as ScoreBand | null) ?? null;
  const findings = [...bundle.findings].sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity));
  const bySev = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) bySev[f.severity]++;

  const categories = Object.keys(CATEGORY_LABELS) as CheckCategory[];
  const checksByCategory = categories
    .map((category) => ({ category, label: CATEGORY_LABELS[category], checks: bundle.checks.filter((c) => c.category === category) }))
    .filter((g) => g.checks.length);

  const notable = bySev.critical + bySev.high + bySev.medium;
  const summaryText =
    a.status !== "completed"
      ? "The assessment has not completed."
      : a.score === null
        ? "No scorable checks could be completed for this website, so no score was calculated."
        : `${a.checks_performed} automated configuration checks were completed for ${a.target_domain}; ${a.checks_passed} passed and ${a.checks_attention} need attention. ` +
          (notable
            ? `${notable} finding${notable === 1 ? "" : "s"} of medium severity or above ${notable === 1 ? "was" : "were"} identified and should be reviewed.`
            : "No findings of medium severity or above were identified by these limited checks.");

  return {
    reportNumber: bundle.report.report_number,
    domain: a.target_domain,
    websiteName: bundle.lead.website_name,
    companyName: bundle.lead.company,
    assessmentDate: a.completed_at ?? a.created_at,
    status: a.status,
    score: a.score,
    band,
    bandLabel: band ? BAND_LABELS[band] : null,
    disclaimer: SCORE_DISCLAIMER,
    summaryText,
    counts: { performed: a.checks_performed, passed: a.checks_passed, attention: a.checks_attention, unavailable: a.checks_unavailable, findings: findings.length },
    findingsBySeverity: bySev,
    findings,
    checksByCategory,
    technologies: (a.technologies ?? []) as TechnologyObservation[],
    limitations: (a.limitations ?? []) as string[],
    generalRecommendations: GENERAL_RECOMMENDATIONS,
  };
}

/** Only public-safe fields; nothing about other users, internal IDs or scanner internals. */
export function toPublicReport(bundle: ReportBundle) {
  const vm = buildReportViewModel(bundle);
  return {
    ...vm,
    findings: vm.findings.map((f) => ({
      key: f.finding_key,
      title: f.title,
      category: f.category,
      severity: f.severity,
      observation: f.observation,
      explanation: f.explanation,
      impact: f.impact,
      remediation: f.remediation,
      evidence: f.evidence,
      confidence: f.confidence,
      limitation: f.limitation,
    })),
    checksByCategory: vm.checksByCategory.map((g) => ({
      ...g,
      checks: g.checks.map((c) => ({ key: c.check_key, title: c.title, status: c.status, summary: c.summary, maxPoints: c.max_points, earnedPoints: c.earned_points })),
    })),
    errorMessage: bundle.assessment.status === "failed" ? bundle.assessment.error_message : null,
  };
}
export type PublicReport = ReturnType<typeof toPublicReport>;
