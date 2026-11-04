import { describe, expect, it } from "vitest";
import { analyzeHeaders, cspWeaknesses, parseCsp } from "@/lib/scanner/modules/headers";
import { SECURE_HEADERS } from "../helpers/mock-net";

const byKey = (r: ReturnType<typeof analyzeHeaders>, k: string) => r.checks.find((c) => c.key === k)!;

describe("analyzeHeaders", () => {
  it("passes a well-configured response with no findings", () => {
    const r = analyzeHeaders(SECURE_HEADERS);
    expect(r.checks.every((c) => c.status === "pass")).toBe(true);
    expect(r.findings).toHaveLength(0);
    expect(r.checks.reduce((s, c) => s + c.maxPoints, 0)).toBe(25);
  });

  it("flags missing headers conservatively (never Critical or High)", () => {
    const r = analyzeHeaders({ "content-type": "text/html" });
    expect(byKey(r, "hsts").status).toBe("fail");
    expect(byKey(r, "csp").status).toBe("fail");
    expect(byKey(r, "framing_protection").status).toBe("fail");
    expect(byKey(r, "referrer_policy").status).toBe("warn");
    expect(r.findings.length).toBeGreaterThanOrEqual(6);
    expect(r.findings.some((f) => f.severity === "critical" || f.severity === "high")).toBe(false);
    expect(r.findings.find((f) => f.key === "hsts_missing")?.severity).toBe("medium");
  });

  it("detects weak HSTS and permissive CSP", () => {
    const r = analyzeHeaders({ ...SECURE_HEADERS, "strict-transport-security": "max-age=300", "content-security-policy": "default-src * ; script-src 'self' 'unsafe-inline'" });
    expect(byKey(r, "hsts").status).toBe("warn");
    expect(byKey(r, "csp").status).toBe("warn");
    expect(r.findings.map((f) => f.key)).toEqual(expect.arrayContaining(["hsts_weak", "csp_weak"]));
  });

  it("treats CSP frame-ancestors as clickjacking protection and ALLOW-FROM as weak", () => {
    const h = { ...SECURE_HEADERS } as Record<string, string>;
    delete h["x-frame-options"];
    expect(byKey(analyzeHeaders(h), "framing_protection").status).toBe("pass");
    const weak = analyzeHeaders({ "x-frame-options": "ALLOW-FROM https://a.com" });
    expect(byKey(weak, "framing_protection").status).toBe("warn");
  });

  it("marks everything unavailable without a response (not penalised)", () => {
    const r = analyzeHeaders(null);
    expect(r.checks.every((c) => c.status === "unavailable" && c.earnedPoints === 0)).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("explains the purpose of each header in evidence", () => {
    const r = analyzeHeaders({});
    expect(String(byKey(r, "hsts").evidence.purpose)).toMatch(/HTTPS/);
  });
});

describe("CSP parsing", () => {
  it("accepts nonce-based unsafe-inline (CSP3 fallback pattern)", () => {
    expect(cspWeaknesses(parseCsp("script-src 'self' 'unsafe-inline' 'nonce-xyz'"))).toEqual([]);
  });
  it("flags missing script/default-src", () => {
    expect(cspWeaknesses(parseCsp("frame-ancestors 'none'"))).toContain("no script-src or default-src directive");
  });
});
