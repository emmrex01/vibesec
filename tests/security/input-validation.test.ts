import { describe, expect, it } from "vitest";
import { assessmentSubmissionSchema, consultationSchema, deletionRequestSchema, leadUpdateSchema, settingsSchema } from "@/lib/validation/schemas";
import { VALID_SUBMISSION } from "../helpers/memory-repo";

describe("malicious input validation", () => {
  it("accepts a valid submission", () => {
    expect(assessmentSubmissionSchema.safeParse(VALID_SUBMISSION).success).toBe(true);
  });

  it.each([
    ["script tag in name", { fullName: "<script>alert(1)</script>" }],
    ["HTML in company", { company: "<img src=x onerror=alert(1)>" }],
    ["control characters", { fullName: "Ada\u0000Founder" }],
    ["overlong name", { fullName: "a".repeat(500) }],
    ["invalid email", { email: "not-an-email" }],
    ["header injection in email", { email: "a@b.com\r\nBcc: x@y.com" }],
    ["private URL", { websiteUrl: "http://169.254.169.254/" }],
    ["javascript URL", { websiteUrl: "javascript:alert(1)" }],
    ["missing authorization", { authorizationConfirmed: false }],
    ["unknown platform", { platform: "hacker-os" }],
    ["bad idempotency key", { idempotencyKey: "short" }],
    ["honeypot filled", { company_fax: "bot" }],
  ])("rejects %s", (_label, patch) => {
    expect(assessmentSubmissionSchema.safeParse({ ...VALID_SUBMISSION, ...patch }).success).toBe(false);
  });

  it("does not require marketing consent", () => {
    const r = assessmentSubmissionSchema.safeParse({ ...VALID_SUBMISSION, marketingConsent: undefined });
    expect(r.success).toBe(true);
  });

  it("validates consultation, deletion, admin update and settings payloads", () => {
    expect(consultationSchema.safeParse({ fullName: "Ada", email: "a@b.co", message: "Please help with RLS review" }).success).toBe(true);
    expect(consultationSchema.safeParse({ fullName: "Ada", email: "a@b.co", message: "<b>hi</b> there friend" }).success).toBe(false);
    expect(deletionRequestSchema.safeParse({ email: "x" }).success).toBe(false);
    expect(leadUpdateSchema.safeParse({}).success).toBe(false);
    expect(leadUpdateSchema.safeParse({ status: "hacked" }).success).toBe(false);
    expect(settingsSchema.safeParse({ businessName: "VibeSec", reportBrandColor: "red;}", leadRetentionDays: 365, services: [] }).success).toBe(false);
    expect(settingsSchema.safeParse({ businessName: "VibeSec", reportBrandColor: "#112233", leadRetentionDays: 5, services: [] }).success).toBe(false);
  });
});
