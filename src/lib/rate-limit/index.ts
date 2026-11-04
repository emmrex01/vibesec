import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimiter {
  /** Returns true when the action is allowed. */
  limit(key: string, max: number, windowSeconds: number): Promise<boolean>;
}

/** In-process limiter — used for tests and local development only. */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { start: number; count: number }>();
  constructor(private readonly now: () => number = Date.now) {}
  async limit(key: string, max: number, windowSeconds: number) {
    const t = this.now();
    const b = this.buckets.get(key);
    if (!b || t - b.start >= windowSeconds * 1000) {
      this.buckets.set(key, { start: t, count: 1 });
      return true;
    }
    b.count++;
    return b.count <= max;
  }
}

/** Upstash Redis sliding-window limiter (recommended in production). */
export class UpstashRateLimiter implements RateLimiter {
  private redis: Redis;
  private limiters = new Map<string, Ratelimit>();
  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }
  async limit(key: string, max: number, windowSeconds: number) {
    const id = `${max}:${windowSeconds}`;
    let rl = this.limiters.get(id);
    if (!rl) {
      rl = new Ratelimit({ redis: this.redis, limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`), prefix: "vibesec" });
      this.limiters.set(id, rl);
    }
    const { success } = await rl.limit(key);
    return success;
  }
}

/** Postgres-backed fixed-window limiter (scan_rate_limits table) when Redis is not configured. */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(private readonly rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {}
  async limit(key: string, max: number, windowSeconds: number) {
    const { data, error } = await this.rpc("check_rate_limit", { p_key: key, p_limit: max, p_window_seconds: windowSeconds });
    if (error) {
      // Fail closed for abuse protection.
      console.error("[rate-limit] database limiter error");
      return false;
    }
    return data === true;
  }
}

export const LIMITS = {
  submitPerIp: { max: 5, windowSeconds: 3600 },
  submitPerDomain: { max: 3, windowSeconds: 86400 },
  submitGlobalPerMinute: { max: 30, windowSeconds: 60 },
  contactPerIp: { max: 5, windowSeconds: 3600 },
  deletionPerIp: { max: 3, windowSeconds: 3600 },
  statusPerIp: { max: 240, windowSeconds: 600 },
  reportPerIp: { max: 120, windowSeconds: 600 },
  runPerIp: { max: 30, windowSeconds: 600 },
  adminLoginPerIp: { max: 10, windowSeconds: 900 },
} as const;
