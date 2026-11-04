import { clientIp, errorJson, handleError, json } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { bearerToken, hashIp } from "@/lib/security/tokens";
import { loadBundleForToken, publicStatus } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns status for the assessment identified by the bearer report token (never by ID). */
export async function GET(req: Request) {
  try {
    const token = bearerToken(req.headers.get("authorization"));
    if (!token) return errorJson(401, "unauthorized", "Missing report token.");
    const deps = await buildServiceDeps();
    if (!(await deps.limiter.limit(`status:ip:${hashIp(clientIp(req), deps.ipSalt)}`, LIMITS.statusPerIp.max, LIMITS.statusPerIp.windowSeconds))) {
      return errorJson(429, "rate_limited", "Too many requests. Please wait a moment.");
    }
    const bundle = await loadBundleForToken(token, deps);
    return json({ ok: true, ...publicStatus(bundle) });
  } catch (e) {
    return handleError(e, "assessment/status");
  }
}
