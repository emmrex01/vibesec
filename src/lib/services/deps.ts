import "server-only";
import { publicEnv, serverEnv } from "@/config/env";
import { createMailer } from "@/lib/email";
import { SupabaseRateLimiter, UpstashRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { runScan } from "@/lib/scanner";
import { getSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ServiceDeps } from "./assessment-service";
import { SupabaseRepository } from "./supabase-repository";

let limiter: RateLimiter | null = null;
export function getRateLimiter(): RateLimiter {
  if (limiter) return limiter;
  const env = serverEnv();
  limiter =
    env.upstashUrl && env.upstashToken
      ? new UpstashRateLimiter(env.upstashUrl, env.upstashToken)
      : new SupabaseRateLimiter(async (fn, args) => {
          const res = await createServiceClient().rpc(fn, args);
          return { data: res.data, error: res.error };
        });
  return limiter;
}

export async function buildServiceDeps(): Promise<ServiceDeps> {
  const env = serverEnv();
  const settings = await getSettings();
  return {
    repo: new SupabaseRepository(),
    limiter: getRateLimiter(),
    mailer: createMailer({ name: settings.emailFromName, address: settings.emailFromAddress }),
    scanner: (url) => runScan(url),
    now: () => new Date(),
    settings,
    siteUrl: publicEnv.siteUrl,
    adminEmail: env.adminNotificationEmail || settings.contactEmail || null,
    ipSalt: env.ipHashSalt || env.supabaseServiceRoleKey.slice(-16),
    maxConcurrentScans: Number.isFinite(env.maxConcurrentScans) ? env.maxConcurrentScans : 10,
    tokenTtlDays: Number.isFinite(env.reportTokenTtlDays) ? env.reportTokenTtlDays : 90,
  };
}
