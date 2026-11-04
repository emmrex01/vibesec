import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/config/defaults";
import { generateReportPdf, pdfSafe } from "@/lib/pdf/report-pdf";
import { buildReportViewModel, toPublicReport } from "@/lib/reports/view-model";
import { runScan } from "@/lib/scanner";
import { calculateScore } from "@/lib/scoring/score";
import type { ReportBundle } from "@/lib/services/repository";
import { mockResolver, mockTransport, scannerDeps } from "../helpers/mock-net";

async function bundle(): Promise<ReportBundle> {
  const scan = await runScan(
    "https://example.com",
    scannerDeps({
      resolver: mockResolver({ "example.com": ["93.184.215.14"] }),
      transport: mockTransport({
        "https://example.com/": { status: 200, headers: { "content-type": "text/html", server: "nginx/1.18.0", "set-cookie": ["sid=x; Path=/"] }, body: Buffer.from("<html><script src='http://cdn.example.net/x.js'></script></html>") },
        "http://example.com/": { status: 200 },
      }),
    }),
  );
  const s = calculateScore(scan.checks, scan.findings);
  return {
    report: { id: "r1", report_number: "VSH-2026-ABCDEFGH", assessment_id: "a1", lead_id: "l1", token_hash: "x".repeat(64), token_expires_at: "2027-01-01T00:00:00Z", revoked_at: null, status: "ready", generated_at: scan.completedAt, first_viewed_at: null, view_count: 0, pdf_downloads: 0, created_at: scan.startedAt },
    assessment: { id: "a1", lead_id: "l1", idempotency_key: "k", target_url: scan.targetUrl, target_domain: scan.hostname, final_url: scan.finalUrl, status: "completed", score: s.score, score_band: s.band, checks_performed: s.checksPerformed, checks_passed: s.checksPassed, checks_attention: s.checksNeedingAttention, checks_unavailable: s.checksUnavailable, findings_count: scan.findings.length, findings_by_severity: s.findingsBySeverity, category_scores: s.categories, technologies: scan.technologies, limitations: scan.limitations, error_message: null, attempts: 1, started_at: scan.startedAt, completed_at: scan.completedAt, duration_ms: 10, created_at: scan.startedAt },
    lead: { id: "l1", full_name: "Ada", email: "ada@x.com", company: "Example Corp — “Ltd”", website_name: "Example ✓ App", target_domain: "example.com", status: "assessment_completed", priority: "B", wants_remediation_help: false },
    checks: scan.checks.map((c) => ({ check_key: c.key, category: c.category, title: c.title, status: c.status, max_points: c.maxPoints, earned_points: c.earnedPoints, summary: c.summary, evidence: c.evidence })),
    findings: scan.findings.map((f) => ({ finding_key: f.key, check_key: f.checkKey, category: f.category, title: f.title, severity: f.severity, observation: f.observation, explanation: f.explanation, impact: f.impact, remediation: f.remediation, evidence: f.evidence, confidence: f.confidence, limitation: f.limitation })),
  };
}

describe("report generation", () => {
  it("builds a view model with findings sorted by severity and separate general guidance", async () => {
    const vm = buildReportViewModel(await bundle());
    const order = ["critical", "high", "medium", "low", "informational"];
    const sev = vm.findings.map((f) => order.indexOf(f.severity));
    expect(sev).toEqual([...sev].sort((a, b) => a - b));
    expect(vm.generalRecommendations.length).toBeGreaterThan(0);
    expect(vm.disclaimer).toMatch(/not a certification/);
  });

  it("public report contains no internal identifiers or contact data", async () => {
    const pub = JSON.stringify(toPublicReport(await bundle()));
    expect(pub).not.toContain("ada@x.com");
    expect(pub).not.toContain("token_hash");
    expect(pub).not.toContain("93.184.215.14");
  });

  it("generates a valid multi-page PDF with unicode text sanitised", async () => {
    const vm = buildReportViewModel(await bundle());
    const bytes = await generateReportPdf(vm, defaultSettings(), { website: "https://vibesec.example", email: "hello@vibesec.example", whatsapp: "+44 7000 000000", consultationUrl: "https://health.vibesec.test/contact" });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
    expect(doc.getTitle()).toContain("example.com");
  });

  it("pdfSafe replaces characters standard fonts cannot encode", () => {
    expect(pdfSafe("“Hi” — ✓ 日本")).toBe('"Hi" - ? ??');
  });
});
