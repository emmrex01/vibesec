import { describe, expect, it } from "vitest";
import { runScan, ScanTargetError } from "@/lib/scanner";
import { calculateScore } from "@/lib/scoring/score";
import { mockDns, mockResolver, mockTls, mockTransport, scannerDeps, SECURE_HEADERS } from "../helpers/mock-net";

describe("runScan (mock target websites)", () => {
  it("scores a well-configured site highly", async () => {
    const transport = mockTransport({
      "https://example.com/": { status: 200, headers: { ...SECURE_HEADERS, "set-cookie": ["sid=1; Secure; HttpOnly; SameSite=Lax"] }, body: Buffer.from("<!doctype html><html></html>") },
      "http://example.com/": { status: 308, headers: { location: "https://example.com/" } },
    });
    const scan = await runScan("example.com", scannerDeps({
      transport,
      dns: mockDns({ txt: { "example.com": [["v=spf1 -all"]], "_dmarc.example.com": [["v=DMARC1; p=reject"]] }, ds: true }),
    }));
    const s = calculateScore(scan.checks, scan.findings);
    expect(s.score).toBe(100);
    expect(scan.findings).toHaveLength(0);
    // Exactly two HTTP requests + one TLS probe: bounded and non-intrusive.
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests.every((r) => r.method === "GET" && r.ip === "93.184.215.14")).toBe(true);
  });

  it("scores a poorly configured site lower, with conservative severities", async () => {
    const scan = await runScan("https://example.com", scannerDeps({
      transport: mockTransport({
        "https://example.com/": { status: 200, headers: { "content-type": "text/html", server: "Apache/2.2.15", "set-cookie": ["PHPSESSID=abc"] }, body: Buffer.from("<html></html>") },
        "http://example.com/": { status: 200 },
      }),
    }));
    const s = calculateScore(scan.checks, scan.findings);
    expect(s.score).toBeLessThan(60);
    expect(scan.findings.some((f) => f.severity === "critical")).toBe(false);
  });

  it("marks checks unavailable when the site is down instead of treating it as a vulnerability", async () => {
    const scan = await runScan("https://example.com", scannerDeps({
      transport: mockTransport({ "https://example.com/": { error: "timeout" }, "http://example.com/": { error: "timeout" } }),
      tls: mockTls(new Error("timeout")),
    }));
    expect(scan.findings.filter((f) => f.category !== "dns")).toHaveLength(0);
    expect(scan.checks.filter((c) => c.status === "unavailable").length).toBeGreaterThan(10);
  });

  it("refuses targets that resolve to private networks before connecting", async () => {
    const transport = mockTransport({});
    const tls = mockTls();
    await expect(runScan("https://internal.example.com", scannerDeps({ resolver: mockResolver({ "internal.example.com": ["10.1.2.3"] }), transport, tls }))).rejects.toBeInstanceOf(ScanTargetError);
    expect(transport.requests).toHaveLength(0);
    expect(tls.calls).toHaveLength(0);
  });

  it("never follows URLs discovered in page content", async () => {
    const transport = mockTransport({
      "https://example.com/": { status: 200, headers: SECURE_HEADERS, body: Buffer.from(`<a href="https://example.com/admin">x</a><script src="https://evil.example.net/x.js"></script>`) },
      "http://example.com/": { error: "ECONNREFUSED" },
    });
    await runScan("https://example.com", scannerDeps({ transport }));
    expect(transport.requests.map((r) => r.url.toString()).sort()).toEqual(["http://example.com/", "https://example.com/"]);
  });
});
