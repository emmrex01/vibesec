import { clientIp, handleError, json, readJson } from "@/lib/http";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { ServiceError, submitDeletionRequest } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";
import { deletionRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = deletionRequestSchema.parse(await readJson(req));
    if (body.company_fax) throw new ServiceError(400, "rejected", "Submission rejected.");
    const ip = clientIp(req);
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw new ServiceError(400, "bot_check_failed", "Bot protection check failed. Please try again.");
    const deps = await buildServiceDeps();
    await submitDeletionRequest(body, { ip, userAgent: null }, deps);
    return json({ ok: true }, 201);
  } catch (e) {
    return handleError(e, "data-deletion");
  }
}
