import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/rate-limit";
import { ServiceError, submitAssessment, submitConsultation } from "@/lib/services/assessment-service";
import { makeServiceDeps, VALID_SUBMISSION } from "../helpers/memory-repo";

describe("rate limiting", () => {
  it("memory limiter enforces a fixed window", async () => {
    let t = 0;
    const l = new MemoryRateLimiter(() => t);
    expect(await l.limit("k", 2, 60)).toBe(true);
    expect(await l.limit("k", 2, 60)).toBe(true);
    expect(await l.limit("k", 2, 60)).toBe(false);
    t = 61_000;
    expect(await l.limit("k", 2, 60)).toBe(true);
  });

  it("limits assessment submissions per IP", async () => {
    const { deps } = makeServiceDeps();
    const ctx = { ip: "203.0.113.50", userAgent: "test" };
    const domains = ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"];
    const results: (string | number)[] = [];
    for (const [i, d] of domains.entries()) {
      try {
        await submitAssessment({ ...VALID_SUBMISSION, websiteUrl: `https://${d}`, idempotencyKey: `ip-limit-key-${i}-0123456789` }, ctx, deps);
        results.push("ok");
      } catch (e) {
        results.push((e as ServiceError).status);
      }
    }
    expect(results).toEqual(["ok", "ok", "ok", "ok", "ok", 429]);
  });

  it("limits assessment frequency per domain across different IPs", async () => {
    const { deps } = makeServiceDeps();
    const statuses: (string | number)[] = [];
    for (let i = 0; i < 4; i++) {
      try {
        await submitAssessment({ ...VALID_SUBMISSION, websiteUrl: "https://app.target.com", idempotencyKey: `domain-limit-${i}-0123456789` }, { ip: `198.51.100.${i}`, userAgent: null }, deps);
        statuses.push("ok");
      } catch (e) {
        statuses.push((e as ServiceError).status);
      }
    }
    expect(statuses).toEqual(["ok", "ok", "ok", 429]);
  });

  it("limits consultation requests per IP", async () => {
    const { deps } = makeServiceDeps();
    const input = { fullName: "Ada", email: "ada@x.com", message: "Need help with Supabase RLS" };
    for (let i = 0; i < 5; i++) await submitConsultation(input, { ip: "1.2.3.4", userAgent: null }, deps);
    await expect(submitConsultation(input, { ip: "1.2.3.4", userAgent: null }, deps)).rejects.toMatchObject({ status: 429 });
  });
});
