import { clientIp, errorJson, handleError, json } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { toPublicReport } from "@/lib/reports/view-model";
import { hashIp } from "@/lib/security/tokens";
import { loadBundleForToken } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const deps = await buildServiceDeps();
    if (!(await deps.limiter.limit(`report:ip:${hashIp(clientIp(req), deps.ipSalt)}`, LIMITS.reportPerIp.max, LIMITS.reportPerIp.windowSeconds))) {
      return errorJson(429, "rate_limited", "Too many requests. Please wait a moment.");
    }
    const bundle = await loadBundleForToken(token, deps);
    if (bundle.assessment.status === "completed" && new URL(req.url).searchParams.get("view") === "1") {
      await deps.repo.recordReportView(bundle.report.id);
    }
    return json({ ok: true, report: toPublicReport(bundle) }, 200, { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  } catch (e) {
    return handleError(e, "report/get");
  }
}
