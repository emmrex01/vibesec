import { after } from "next/server";
import { clientIp, handleError, json, readJson } from "@/lib/http";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { runAssessmentByToken, ServiceError, submitAssessment } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";
import { assessmentSubmissionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = assessmentSubmissionSchema.parse(await readJson(req));
    if (body.company_fax) throw new ServiceError(400, "rejected", "Submission rejected.");
    const ip = clientIp(req);
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw new ServiceError(400, "bot_check_failed", "Bot protection check failed. Please try again.");

    const deps = await buildServiceDeps();
    const result = await submitAssessment(body, { ip, userAgent: req.headers.get("user-agent") }, deps);

    // Start the bounded passive scan after the response is sent. The client may also call
    // /api/assessment/run; claiming is atomic so the scan only runs once.
    if (result.created) {
      after(async () => {
        try {
          await runAssessmentByToken(result.reportToken, deps);
        } catch (e) {
          console.error("[assessment/submit] background run failed", (e as Error)?.name);
        }
      });
    }

    return json({ ok: true, reportToken: result.reportToken, reportPath: `/report/${result.reportToken}` }, result.created ? 201 : 200);
  } catch (e) {
    return handleError(e, "assessment/submit");
  }
}
