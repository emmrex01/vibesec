import { describe, expect, it } from "vitest";
import { buildReportViewModel } from "@/lib/reports/view-model";
import { generateReportPdf } from "@/lib/pdf/report-pdf";
import { runScan, ScanTargetError } from "@/lib/scanner";
import {
  loadBundleForToken,
  publicStatus,
  runAssessmentByToken,
  submitAssessment,
  submitConsultation,
  submitDeletionRequest,
} from "@/lib/services/assessment-service";
import { defaultSettings } from "@/config/defaults";
import { makeServiceDeps, MemoryRepository, VALID_SUBMISSION } from "../helpers/memory-repo";
import { mockDns, mockTransport, scannerDeps, SECURE_HEADERS } from "../helpers/mock-net";

const ctx = { ip: "203.0.113.7", userAgent: "vitest" };

function mockSiteScanner() {
  const deps = scannerDeps({
    transport: mockTransport({
      "https://example.com/": { status: 200, headers: { ...SECURE_HEADERS, "strict-transport-security": undefined as unknown as string, server: "nginx/1.25.3" }, body: Buffer.from("<!doctype html><html></html>") },
      "http://example.com/": { status: 301, headers: { location: "https://example.com/" } },
    }),
    dns: mockDns({ txt: { "example.com": [["v=spf1 -all"]] } }),
  });
  return (url: string) => runScan(url, deps);
}

describe("lead submission", () => {
  it("creates lead, assessment, report and consent records", async () => {
    const { deps, repo, mailer } = makeServiceDeps();
    const r = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect(r.created).toBe(true);
    const lead = [...repo.leads.values()][0];
    expect(lead).toMatchObject({ email: "ada@examplecorp.com", target_domain: "example.com", authorization_confirmed: true, marketing_consent: false, marketing_consent_at: null, status: "assessment_started", is_test: true });
    expect(lead.submitter_ip_hash).not.toContain("203.0.113.7");
    expect(repo.consents.map((c) => [c.consent_type, c.granted])).toEqual([["assessment_authorization", true], ["privacy_notice", true], ["marketing", false]]);
    expect([...repo.assessments.values()][0].status).toBe("queued");
    expect(mailer.sent[0].subject).toBe("Your VibeSec Security Health Check Has Started");
    expect(mailer.sent[0].text).toContain(`/report/${r.reportToken}`);
  });

  it("records marketing consent separately with a timestamp", async () => {
    const { deps, repo } = makeServiceDeps();
    await submitAssessment({ ...VALID_SUBMISSION, marketingConsent: true }, ctx, deps);
    const lead = [...repo.leads.values()][0];
    expect(lead.marketing_consent).toBe(true);
    expect(lead.marketing_consent_at).toBeTruthy();
  });

  it("is idempotent: a retried submission returns the same assessment and invalidates the old link", async () => {
    const { deps, repo } = makeServiceDeps();
    const first = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    const second = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect(second.created).toBe(false);
    expect(second.assessmentId).toBe(first.assessmentId);
    expect(repo.leads.size).toBe(1);
    await expect(loadBundleForToken(first.reportToken, deps)).rejects.toMatchObject({ status: 404 });
    expect((await loadBundleForToken(second.reportToken, deps)).assessment.id).toBe(first.assessmentId);
  });
});

describe("assessment lifecycle", () => {
  it("runs the passive scanner, stores checks + findings, scores and notifies", async () => {
    const { deps, repo, mailer } = makeServiceDeps({ scanner: mockSiteScanner() });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect(publicStatus(await loadBundleForToken(sub.reportToken, deps)).status).toBe("queued");

    const run = await runAssessmentByToken(sub.reportToken, deps);
    expect(run.status).toBe("completed");

    const bundle = await loadBundleForToken(sub.reportToken, deps);
    expect(bundle.assessment.status).toBe("completed");
    expect(bundle.assessment.score).toBeGreaterThan(0);
    expect(bundle.checks.length).toBeGreaterThan(15);
    expect(bundle.findings.map((f) => f.finding_key)).toEqual(expect.arrayContaining(["hsts_missing", "server_version_disclosure"]));
    expect(bundle.report.status).toBe("ready");
    expect([...repo.leads.values()][0].status).toBe("assessment_completed");

    const subjects = mailer.sent.map((m) => m.subject);
    expect(subjects).toContain("Your Website Security Health Report Is Ready");
    expect(subjects.some((s) => s.startsWith("New Priority"))).toBe(true);

    // PDF from stored results
    const pdf = await generateReportPdf(buildReportViewModel(bundle), defaultSettings(), { website: null, email: null, whatsapp: null, consultationUrl: "https://x/contact" });
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });

  it("runs only once even when triggered concurrently", async () => {
    let calls = 0;
    const scanner = mockSiteScanner();
    const { deps } = makeServiceDeps({ scanner: async (u) => { calls++; return scanner(u); } });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    const results = await Promise.all([runAssessmentByToken(sub.reportToken, deps), runAssessmentByToken(sub.reportToken, deps), runAssessmentByToken(sub.reportToken, deps)]);
    expect(calls).toBe(1);
    expect(results.filter((r) => r.status === "completed")).toHaveLength(1);
  });

  it("queues when the concurrency limit is reached", async () => {
    const { deps } = makeServiceDeps({ scanner: mockSiteScanner(), maxConcurrentScans: 0 });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect((await runAssessmentByToken(sub.reportToken, deps)).status).toBe("queued");
  });

  it("fails cleanly (no fabricated results) when the target is not assessable", async () => {
    const { deps, repo } = makeServiceDeps({ scan: new ScanTargetError("This website address resolves to a private or reserved network and cannot be assessed.") });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect((await runAssessmentByToken(sub.reportToken, deps)).status).toBe("failed");
    const b = await loadBundleForToken(sub.reportToken, deps);
    expect(b.assessment.score).toBeNull();
    expect(b.findings).toHaveLength(0);
    expect(publicStatus(b).message).toMatch(/private or reserved/);
    expect([...repo.reports.values()][0].status).toBe("failed");
  });

  it("retries transient errors before failing", async () => {
    const { deps } = makeServiceDeps({ scan: new Error("ECONNRESET") });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect((await runAssessmentByToken(sub.reportToken, deps)).status).toBe("queued");
    expect((await runAssessmentByToken(sub.reportToken, deps)).status).toBe("queued");
    expect((await runAssessmentByToken(sub.reportToken, deps)).status).toBe("failed");
  });
});

describe("report retrieval & conversion", () => {
  it("records report views", async () => {
    const { deps, repo } = makeServiceDeps({ scanner: mockSiteScanner() });
    const sub = await submitAssessment(VALID_SUBMISSION, ctx, deps);
    await runAssessmentByToken(sub.reportToken, deps);
    const b = await loadBundleForToken(sub.reportToken, deps);
    await repo.recordReportView(b.report.id);
    expect(repo.reports.get(b.report.id)!.view_count).toBe(1);
  });

  it("consultation requests are stored, linked to the lead and upgrade priority", async () => {
    const { deps, repo, mailer } = makeServiceDeps({ scanner: mockSiteScanner() });
    await submitAssessment(VALID_SUBMISSION, ctx, deps);
    expect([...repo.leads.values()][0].priority).toBe("B");
    await submitConsultation({ fullName: "Ada Founder", email: "ADA@examplecorp.com", message: "Please help us fix these findings", service: "Vulnerability remediation", source: "report" }, ctx, deps);
    const lead = [...repo.leads.values()][0];
    expect(repo.consultations[0].lead_id).toBe(lead.id);
    expect(lead.priority).toBe("A");
    expect(lead.status).toBe("interested");
    expect(mailer.sent.at(-1)!.subject).toMatch(/New consultation request/);
  });

  it("stores data deletion requests", async () => {
    const repo = new MemoryRepository();
    const { deps } = makeServiceDeps({ repo });
    await submitDeletionRequest({ email: "ada@examplecorp.com" }, ctx, deps);
    expect(repo.deletionRequests).toHaveLength(1);
  });
});
