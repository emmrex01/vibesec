import { CATEGORY_WEIGHTS, SEVERITY_ORDER, type CheckCategory, type CheckResult, type Finding, type Severity } from "@/lib/scanner/types";

export const SCORE_DISCLAIMER =
  "This score represents the results of a limited automated security configuration assessment. It is not a certification, guarantee of security or substitute for a full security audit.";

export type ScoreBand = "good" | "improvement" | "several" | "significant";

export const BAND_LABELS: Record<ScoreBand, string> = {
  good: "Good observed configuration",
  improvement: "Improvement recommended",
  several: "Several configuration improvements recommended",
  significant: "Significant configuration concerns identified",
};

export interface CategoryScore {
  category: CheckCategory;
  earned: number;
  available: number;
  weight: number;
  percent: number | null;
}

export interface ScoreSummary {
  /** null when no scorable checks could be performed */
  score: number | null;
  band: ScoreBand | null;
  bandLabel: string | null;
  checksPerformed: number;
  checksPassed: number;
  checksNeedingAttention: number;
  checksUnavailable: number;
  checksNotApplicable: number;
  findingsBySeverity: Record<Severity, number>;
  categories: CategoryScore[];
}

export function bandFor(score: number): ScoreBand {
  if (score >= 80) return "good";
  if (score >= 60) return "improvement";
  if (score >= 40) return "several";
  return "significant";
}

const SCORED: CheckCategory[] = ["https_tls", "security_headers", "cookies", "dns", "website"];

/**
 * Score = earned points ÷ available points across checks that were actually performed and applicable.
 * - unavailable / not_applicable / info checks contribute neither earned nor available points
 * - each check's maxPoints are defined in the module that produced it; category maxima sum to CATEGORY_WEIGHTS
 */
export function calculateScore(checks: CheckResult[], findings: Finding[]): ScoreSummary {
  const scorable = checks.filter((c) => c.status === "pass" || c.status === "warn" || c.status === "fail");
  const categories: CategoryScore[] = SCORED.map((category) => {
    const inCat = scorable.filter((c) => c.category === category);
    const earned = inCat.reduce((s, c) => s + c.earnedPoints, 0);
    const available = inCat.reduce((s, c) => s + c.maxPoints, 0);
    return { category, earned, available, weight: CATEGORY_WEIGHTS[category], percent: available ? Math.round((earned / available) * 100) : null };
  });

  const earned = categories.reduce((s, c) => s + c.earned, 0);
  const available = categories.reduce((s, c) => s + c.available, 0);
  const score = available > 0 ? Math.round((earned / available) * 100) : null;

  const findingsBySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) findingsBySeverity[f.severity]++;

  const band = score === null ? null : bandFor(score);
  return {
    score,
    band,
    bandLabel: band ? BAND_LABELS[band] : null,
    checksPerformed: scorable.length,
    checksPassed: scorable.filter((c) => c.status === "pass").length,
    checksNeedingAttention: scorable.filter((c) => c.status !== "pass").length,
    checksUnavailable: checks.filter((c) => c.status === "unavailable").length,
    checksNotApplicable: checks.filter((c) => c.status === "not_applicable").length,
    findingsBySeverity,
    categories,
  };
}
