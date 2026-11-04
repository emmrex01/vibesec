import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/security/tokens";
import { loadBundleForToken, submitAssessment } from "@/lib/services/assessment-service";
import { makeServiceDeps, VALID_SUBMISSION } from "../helpers/memory-repo";

describe("report access control", () => {
  it("each token opens only its own report (no cross-user access)", async () => {
    const { deps } = makeServiceDeps();
    const a = await submitAssessment({ ...VALID_SUBMISSION, idempotencyKey: "user-a-0123456789abcd" }, { ip: "1.1.1.1", userAgent: null }, deps);
    const b = await submitAssessment({ ...VALID_SUBMISSION, email: "bob@other.com", websiteUrl: "https://other.com", idempotencyKey: "user-b-0123456789abcd" }, { ip: "2.2.2.2", userAgent: null }, deps);
    const ba = await loadBundleForToken(a.reportToken, deps);
    const bb = await loadBundleForToken(b.reportToken, deps);
    expect(ba.assessment.id).toBe(a.assessmentId);
    expect(bb.assessment.id).toBe(b.assessmentId);
    expect(ba.lead.email).not.toBe(bb.lead.email);
  });

  it.each(["", "short", "x".repeat(43), "../../../etc", "A".repeat(43)])("rejects invalid or guessed token %s", async (t) => {
    const { deps } = makeServiceDeps();
    await submitAssessment(VALID_SUBMISSION, { ip: "1.1.1.1", userAgent: null }, deps);
    await expect(loadBundleForToken(t, deps)).rejects.toMatchObject({ status: 404 });
  });

  it("cannot be opened with the token hash or assessment id", async () => {
    const { deps, repo } = makeServiceDeps();
    const r = await submitAssessment(VALID_SUBMISSION, { ip: "1.1.1.1", userAgent: null }, deps);
    await expect(loadBundleForToken(hashToken(r.reportToken), deps)).rejects.toMatchObject({ status: 404 });
    await expect(loadBundleForToken(r.assessmentId, deps)).rejects.toMatchObject({ status: 404 });
    expect([...repo.reports.values()][0].token_hash).not.toBe(r.reportToken);
  });

  it("rejects expired and revoked links", async () => {
    const { deps, repo } = makeServiceDeps();
    const r = await submitAssessment(VALID_SUBMISSION, { ip: "1.1.1.1", userAgent: null }, deps);
    const report = [...repo.reports.values()][0];
    repo.reports.set(report.id, { ...report, revoked_at: new Date().toISOString() });
    await expect(loadBundleForToken(r.reportToken, deps)).rejects.toMatchObject({ status: 410, code: "revoked" });
    repo.reports.set(report.id, { ...report, token_expires_at: "2000-01-01T00:00:00Z" });
    await expect(loadBundleForToken(r.reportToken, deps)).rejects.toMatchObject({ status: 410, code: "expired" });
  });
});
