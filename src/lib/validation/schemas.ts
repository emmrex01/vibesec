import { z } from "zod";
import { validateTargetUrl } from "@/lib/security/url";

export const PLATFORMS = [
  { value: "lovable", label: "Lovable" },
  { value: "bolt", label: "Bolt.new" },
  { value: "replit", label: "Replit" },
  { value: "base44", label: "Base44" },
  { value: "wordpress", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "webflow", label: "Webflow" },
  { value: "custom", label: "Custom-built" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "Not sure" },
] as const;
export type PlatformValue = (typeof PLATFORMS)[number]["value"];

export const APP_TYPES = [
  { value: "business_application", label: "Business web application" },
  { value: "business_website", label: "Business website" },
  { value: "personal", label: "Personal / hobby project" },
  { value: "other", label: "Other" },
] as const;

export const LEAD_STATUSES = [
  "new", "assessment_started", "assessment_completed", "report_viewed", "interested", "contacted",
  "meeting_scheduled", "proposal_sent", "converted", "not_interested", "closed",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  assessment_started: "Assessment started",
  assessment_completed: "Assessment completed",
  report_viewed: "Report viewed",
  interested: "Interested",
  contacted: "Contacted",
  meeting_scheduled: "Meeting scheduled",
  proposal_sent: "Proposal sent",
  converted: "Converted",
  not_interested: "Not interested",
  closed: "Closed",
};

export const CONSULTATION_STATUSES = ["new", "contacted", "meeting_scheduled", "closed"] as const;

export const SERVICE_OPTIONS = [
  "Application security audit",
  "Supabase database security review",
  "RLS policy review",
  "API security assessment",
  "Authentication and authorization review",
  "Payment security review",
  "Vulnerability remediation",
  "Production security hardening",
  "Ongoing security maintenance",
  "Not sure yet",
] as const;

export const AUTHORIZATION_TEXT =
  "I confirm that I own this website or have authorization from its owner to request this security assessment.";
export const MARKETING_TEXT = "I agree to receive occasional security insights and relevant VibeSec service updates.";
export const PRIVACY_NOTICE_TEXT =
  "VibeSec processes your contact details and the assessment results to perform the requested assessment, deliver your report and respond to you. See our Privacy Policy for retention and deletion.";

// Unicode-aware but excludes control characters and angle brackets.
const safeText = (max: number) =>
  z.string().trim().max(max).refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v), "Contains invalid characters");

const tristate = z.enum(["yes", "no", "unsure"]).nullish();
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const websiteUrlField = z
  .string()
  .trim()
  .min(1, "Please enter your website address")
  .max(2048)
  .superRefine((v, ctx) => {
    const r = validateTargetUrl(v);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.message });
  });

export const optionalUrlField = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .or(z.literal(""))
  .superRefine((v, ctx) => {
    if (!v) return;
    const r = validateTargetUrl(v);
    if (!r.ok) ctx.addIssue({ code: "custom", message: "Please enter a valid website address" });
  });

export const stepWebsiteSchema = z.object({
  websiteUrl: websiteUrlField,
  websiteName: safeText(160).optional(),
  platform: z.preprocess(emptyToUndefined, z.enum(PLATFORMS.map((p) => p.value) as [PlatformValue, ...PlatformValue[]]).optional()),
});

export const stepContactSchema = z.object({
  fullName: safeText(120).min(2, "Please enter your full name"),
  email: z.email("Please enter a valid email address").trim().toLowerCase().max(254),
  company: safeText(160).min(1, "Please enter your company name"),
  jobTitle: safeText(120).optional(),
  country: safeText(80).min(2, "Please select your country"),
  companyWebsite: optionalUrlField,
});

export const stepApplicationSchema = z.object({
  appType: z.preprocess(emptyToUndefined, z.enum(APP_TYPES.map((a) => a.value) as [string, ...string[]]).optional()),
  hasRegistration: tristate,
  hasLogin: tristate,
  processesPayments: tristate,
  storesCustomerData: tristate,
  usesDatabase: tristate,
  hasAdminDashboard: tristate,
  wantsRemediationHelp: z.boolean().optional(),
});

export const stepConsentSchema = z.object({
  authorizationConfirmed: z.literal(true, { error: "You must confirm you are authorized to request this assessment" }),
  marketingConsent: z.boolean().optional(),
});

export const assessmentSubmissionSchema = stepWebsiteSchema
  .extend(stepContactSchema.shape)
  .extend(stepApplicationSchema.shape)
  .extend(stepConsentSchema.shape)
  .extend({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/, "Invalid request key"),
    turnstileToken: z.string().max(4096).optional(),
    // Honeypot: real users never fill this.
    company_fax: z.string().max(0).optional(),
  });
export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>;

export const consultationSchema = z.object({
  fullName: safeText(120).min(2, "Please enter your full name"),
  email: z.email("Please enter a valid email address").trim().toLowerCase().max(254),
  company: safeText(160).optional(),
  website: optionalUrlField,
  service: z.preprocess(emptyToUndefined, z.enum(SERVICE_OPTIONS).optional()),
  message: safeText(5000).min(10, "Please tell us a little more (at least 10 characters)"),
  source: z.enum(["contact_page", "report", "services", "homepage"]).optional(),
  turnstileToken: z.string().max(4096).optional(),
  company_fax: z.string().max(0).optional(),
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

export const deletionRequestSchema = z.object({
  email: z.email("Please enter a valid email address").trim().toLowerCase().max(254),
  website: optionalUrlField,
  message: safeText(2000).optional(),
  turnstileToken: z.string().max(4096).optional(),
  company_fax: z.string().max(0).optional(),
});

export const leadUpdateSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    owner: safeText(120).optional().nullable(),
    salesNotes: z.string().max(10000).optional().nullable(),
    priority: z.enum(["A", "B", "C"]).optional(),
    note: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update");

export const settingsSchema = z.object({
  businessName: safeText(120).min(1),
  logoUrl: z.url().max(2048).optional().or(z.literal("")),
  contactEmail: z.email().optional().or(z.literal("")),
  whatsappNumber: z.string().trim().regex(/^\+?[0-9 ()-]{0,25}$/, "Digits, spaces and + only").optional().or(z.literal("")),
  websiteUrl: z.url().max(2048).optional().or(z.literal("")),
  bookingUrl: z.url().max(2048).optional().or(z.literal("")),
  assessmentDisclaimer: z.string().trim().max(2000).optional().or(z.literal("")),
  emailFromName: safeText(80).optional().or(z.literal("")),
  emailFromAddress: z.email().optional().or(z.literal("")),
  reportBrandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1fb8d6"),
  leadRetentionDays: z.coerce.number().int().min(30).max(3650),
  services: z
    .array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/), title: safeText(120).min(1), description: safeText(600) }))
    .max(20),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export function triToBool(v: "yes" | "no" | "unsure" | null | undefined): boolean | null {
  return v === "yes" ? true : v === "no" ? false : null;
}
