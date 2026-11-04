import { clientIp, handleError, json, readJson } from "@/lib/http";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { ServiceError, submitConsultation } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";
import { consultationSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = consultationSchema.parse(await readJson(req));
    if (body.company_fax) throw new ServiceError(400, "rejected", "Submission rejected.");
    const ip = clientIp(req);
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw new ServiceError(400, "bot_check_failed", "Bot protection check failed. Please try again.");
    const deps = await buildServiceDeps();
    await submitConsultation(body, { ip, userAgent: req.headers.get("user-agent") }, deps);
    return json({ ok: true }, 201);
  } catch (e) {
    return handleError(e, "contact");
  }
}
