import { publicEnv } from "./env";

export interface ServiceItem {
  slug: string;
  title: string;
  description: string;
}

export interface SiteSettings {
  businessName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  whatsappNumber: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  services: ServiceItem[];
  assessmentDisclaimer: string;
  emailFromName: string | null;
  emailFromAddress: string | null;
  reportBrandColor: string;
  leadRetentionDays: number;
}

export const DEFAULT_SERVICES: ServiceItem[] = [
  { slug: "application-security-audit", title: "Application security audit", description: "Manual review of authentication, authorization, data handling and business logic in your web application." },
  { slug: "supabase-security-review", title: "Supabase database security review", description: "Review of your Supabase project configuration, exposed tables, storage buckets and edge functions." },
  { slug: "rls-policy-review", title: "RLS policy review", description: "Line-by-line review of Row Level Security policies to verify users can only reach their own data." },
  { slug: "api-security-assessment", title: "API security assessment", description: "Authorized testing of your API endpoints for authentication, authorization and input-handling weaknesses." },
  { slug: "auth-review", title: "Authentication and authorization review", description: "Sign-up, login, sessions, password reset and role-based access controls, reviewed end to end." },
  { slug: "payment-security-review", title: "Payment security review", description: "Checkout flows, payment webhooks and subscription logic (Stripe and similar) reviewed for abuse paths." },
  { slug: "vulnerability-remediation", title: "Vulnerability remediation", description: "Hands-on fixes for identified issues, with re-testing to confirm they are resolved." },
  { slug: "production-hardening", title: "Production security hardening", description: "Security headers, secrets management, logging, rate limiting and deployment configuration." },
  { slug: "security-maintenance", title: "Ongoing security maintenance", description: "Regular reviews and on-call support as your application and team grow." },
];

export const DEFAULT_DISCLAIMER =
  "The VibeSec Security Health check is a limited, automated and passive review of publicly observable website configuration. It is not a penetration test, compliance audit, certification or guarantee of security, and it cannot detect every weakness. Findings should be verified by a qualified professional before acting on them.";

export function defaultSettings(): SiteSettings {
  return {
    businessName: "VibeSec",
    logoUrl: null,
    contactEmail: publicEnv.vibesecEmail || null,
    whatsappNumber: publicEnv.vibesecWhatsapp || null,
    websiteUrl: publicEnv.vibesecWebsite || null,
    bookingUrl: publicEnv.bookingUrl || null,
    services: DEFAULT_SERVICES,
    assessmentDisclaimer: DEFAULT_DISCLAIMER,
    emailFromName: "VibeSec",
    emailFromAddress: null,
    reportBrandColor: "#1fb8d6",
    leadRetentionDays: 365,
  };
}
