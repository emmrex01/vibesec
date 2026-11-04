import { clientIp, errorJson, handleError, json } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { bearerToken, hashIp } from "@/lib/security/tokens";
import { loadBundleForToken, runAssessmentForBundle } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Starts (or resumes) the passive checks for the assessment identified by the bearer report token. */
export async function POST(req: Request) {
  try {
    const token = bearerToken(req.headers.get("authorization"));
    if (!token) return errorJson(401, "unauthorized", "Missing report token.");
    const deps = await buildServiceDeps();
    if (!(await deps.limiter.limit(`run:ip:${hashIp(clientIp(req), deps.ipSalt)}`, LIMITS.runPerIp.max, LIMITS.runPerIp.windowSeconds))) {
      return errorJson(429, "rate_limited", "Too many requests. Please wait a moment.");
    }
    const bundle = await loadBundleForToken(token, deps);
    const result = await runAssessmentForBundle(bundle, token, deps);
    return json({ ok: true, status: result.status });
  } catch (e) {
    return handleError(e, "assessment/run");
  }
}
