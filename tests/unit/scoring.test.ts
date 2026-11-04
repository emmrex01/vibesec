import { describe, expect, it } from "vitest";
import type { CheckResult } from "@/lib/scanner/types";
import { bandFor, calculateScore } from "@/lib/scoring/score";
import { isBusinessEmail, scoreLead } from "@/lib/scoring/lead-priority";

const c = (key: string, category: CheckResult["category"], status: CheckResult["status"], max: number, earned: number): CheckResult => ({
  key, category, title: key, status, maxPoints: max, earnedPoints: earned, summary: "", evidence: {},
});

describe("calculateScore", () => {
  it("normalises over performed checks only and ignores unavailable / N/A / info", () => {
    const s = calculateScore(
      [
        c("a", "https_tls", "pass", 10, 10),
        c("b", "security_headers", "fail", 10, 0),
        c("c", "cookies", "unavailable", 15, 0),
        c("d", "dns", "not_applicable", 5, 0),
        c("e", "technology", "info", 0, 0),
      ],
      [],
    );
    expect(s.score).toBe(50);
    expect(s.checksPerformed).toBe(2);
    expect(s.checksPassed).toBe(1);
    expect(s.checksNeedingAttention).toBe(1);
    expect(s.checksUnavailable).toBe(1);
    expect(s.checksNotApplicable).toBe(1);
  });

  it("does not penalise a site for checks that could not be performed", () => {
    const allPass = calculateScore([c("a", "https_tls", "pass", 25, 25)], []);
    const withUnavailable = calculateScore([c("a", "https_tls", "pass", 25, 25), c("b", "dns", "unavailable", 15, 0)], []);
    expect(allPass.score).toBe(100);
    expect(withUnavailable.score).toBe(100);
  });

  it("returns null score when nothing scorable ran", () => {
    expect(calculateScore([c("a", "dns", "unavailable", 5, 0)], []).score).toBeNull();
  });

  it("counts partial (warn) points", () => {
    expect(calculateScore([c("a", "dns", "warn", 4, 2), c("b", "dns", "pass", 4, 4)], []).score).toBe(75);
  });

  it("maps bands per the specification", () => {
    expect([bandFor(100), bandFor(80), bandFor(79), bandFor(60), bandFor(59), bandFor(40), bandFor(39), bandFor(0)]).toEqual([
      "good", "good", "improvement", "improvement", "several", "several", "significant", "significant",
    ]);
  });
});

describe("lead qualification", () => {
  const base = {
    isBusiness: true, hasRegistration: true, hasLogin: true, processesPayments: true, storesCustomerData: true,
    usesDatabase: true, hasAdminDashboard: false, platform: "lovable", email: "ceo@startup.io", wantsRemediationHelp: false, consultationRequested: false,
  };
  it("is Priority B for a relevant app without a request for help", () => {
    expect(scoreLead(base).priority).toBe("B");
  });
  it("is Priority A with explicit interest in remediation", () => {
    expect(scoreLead({ ...base, wantsRemediationHelp: true }).priority).toBe("A");
    expect(scoreLead({ ...base, consultationRequested: true }).priority).toBe("A");
  });
  it("is Priority C for non-business or low-information leads", () => {
    expect(scoreLead({ ...base, isBusiness: false, consultationRequested: true }).priority).toBe("C");
    expect(scoreLead({ isBusiness: null, hasRegistration: null, hasLogin: null, processesPayments: null, storesCustomerData: null, usesDatabase: null, hasAdminDashboard: null, platform: null, email: "x@gmail.com", wantsRemediationHelp: false, consultationRequested: false }).priority).toBe("C");
  });
  it("detects free email providers", () => {
    expect(isBusinessEmail("a@gmail.com")).toBe(false);
    expect(isBusinessEmail("a@acme.co")).toBe(true);
  });
});
