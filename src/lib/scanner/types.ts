export type CheckCategory =
  | "https_tls"
  | "security_headers"
  | "cookies"
  | "dns"
  | "website"
  | "technology";

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  https_tls: "HTTPS and TLS",
  security_headers: "Security headers",
  cookies: "Cookie configuration",
  dns: "DNS and domain configuration",
  website: "Website configuration",
  technology: "Technology observations",
};

/** Maximum points per scored category (sums to 100). Technology is informational only. */
export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  https_tls: 25,
  security_headers: 25,
  cookies: 15,
  dns: 15,
  website: 20,
  technology: 0,
};

/**
 * pass            – check performed, configuration observed as acceptable
 * warn            – check performed, present but potentially weak (partial points)
 * fail            – check performed, missing / not acceptable (no points)
 * info            – informational observation, never scored
 * unavailable     – check could not be performed (NOT penalised)
 * not_applicable  – check does not apply to this site (NOT penalised)
 */
export type CheckStatus = "pass" | "warn" | "fail" | "info" | "unavailable" | "not_applicable";

export type Severity = "critical" | "high" | "medium" | "low" | "informational";
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "informational"];

export type Confidence = "high" | "medium" | "low";

export interface CheckResult {
  key: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  maxPoints: number;
  earnedPoints: number;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface Finding {
  key: string;
  checkKey: string;
  category: CheckCategory;
  title: string;
  observation: string;
  severity: Severity;
  explanation: string;
  impact: string;
  remediation: string;
  evidence: Record<string, unknown>;
  confidence: Confidence;
  limitation: string;
}

export interface TechnologyObservation {
  name: string;
  kind: "framework" | "cms" | "ecommerce" | "hosting" | "cdn" | "backend" | "builder" | "server";
  evidence: string;
  /** Detected technologies are indicators only; never confirmed development history. */
  confidence: Confidence;
}

export interface ScanResult {
  targetUrl: string;
  hostname: string;
  finalUrl: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  checks: CheckResult[];
  findings: Finding[];
  technologies: TechnologyObservation[];
  limitations: string[];
}
