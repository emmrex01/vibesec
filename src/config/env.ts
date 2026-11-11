/**
 * Centralised environment access. Server-only values are read lazily so that they
 * are never bundled into client code (only NEXT_PUBLIC_* values reach the browser).
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  vibesecEmail: process.env.NEXT_PUBLIC_VIBESEC_EMAIL ?? "",
  vibesecWhatsapp: process.env.NEXT_PUBLIC_VIBESEC_WHATSAPP ?? "",
  vibesecWebsite: process.env.NEXT_PUBLIC_VIBESEC_WEBSITE ?? "",
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not be called in the browser");
  return {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    emailFrom: process.env.EMAIL_FROM ?? "",
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
    ipHashSalt: process.env.IP_HASH_SALT ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
    maxConcurrentScans: Number(process.env.MAX_CONCURRENT_SCANS ?? 10),
    reportTokenTtlDays: Number(process.env.REPORT_TOKEN_TTL_DAYS ?? 90),
  };
}

export function isSupabaseConfigured() {
  return !!(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
