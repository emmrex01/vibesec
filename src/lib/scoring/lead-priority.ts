import type { Severity } from "@/lib/scanner/types";

export type LeadPriority = "A" | "B" | "C";

export interface LeadSignals {
  isBusiness: boolean | null;
  hasRegistration: boolean | null;
  hasLogin: boolean | null;
  processesPayments: boolean | null;
  storesCustomerData: boolean | null;
  usesDatabase: boolean | null;
  hasAdminDashboard: boolean | null;
  platform: string | null;
  email: string;
  wantsRemediationHelp: boolean;
  consultationRequested: boolean;
  findingsBySeverity?: Partial<Record<Severity, number>> | null;
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de",
  "mail.com", "yandex.com", "yandex.ru", "zoho.com", "web.de", "qq.com", "163.com",
]);

const PRIORITY_PLATFORMS = new Set(["lovable", "bolt", "replit", "base44", "custom"]);

export function isBusinessEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * INTERNAL commercial qualification only — never a security verdict.
 * Self-reported answers are treated as unverified context.
 */
export function scoreLead(s: LeadSignals): { score: number; priority: LeadPriority; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (pts: number, cond: boolean | null | undefined, why: string) => {
    if (cond) {
      score += pts;
      reasons.push(why);
    }
  };
  add(10, s.isBusiness, "Business website or application");
  add(10, s.hasRegistration || s.hasLogin, "User accounts / login (self-reported)");
  add(12, s.processesPayments, "Processes payments (self-reported)");
  add(10, s.storesCustomerData, "Stores customer information (self-reported)");
  add(4, s.usesDatabase, "Uses a database (self-reported)");
  add(4, s.hasAdminDashboard, "Admin dashboard (self-reported)");
  add(10, !!s.platform && PRIORITY_PLATFORMS.has(s.platform), "AI-builder or custom-built platform");
  add(10, isBusinessEmail(s.email), "Business email domain");
  const notable = (s.findingsBySeverity?.high ?? 0) + (s.findingsBySeverity?.medium ?? 0) + (s.findingsBySeverity?.critical ?? 0);
  add(5, notable > 0, "Assessment produced findings worth discussing");
  add(15, s.wantsRemediationHelp, "Asked for help with remediation");
  add(20, s.consultationRequested, "Requested a consultation");
  score = Math.min(100, score);

  const interest = s.wantsRemediationHelp || s.consultationRequested;
  const relevant = !!s.isBusiness && score >= 40;
  const priority: LeadPriority = relevant && interest && score >= 55 ? "A" : relevant ? "B" : "C";
  return { score, priority, reasons };
}
