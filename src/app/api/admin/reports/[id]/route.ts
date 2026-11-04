import { z } from "zod";
import { publicEnv, serverEnv } from "@/config/env";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorJson, handleError, json, readJson } from "@/lib/http";
import { generateReportToken, hashToken } from "@/lib/security/tokens";
import { runAssessmentForBundle } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ action: z.enum(["rotate_link", "revoke", "rescan"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const id = z.uuid().parse((await params).id);
    const { action } = bodySchema.parse(await readJson(req));
    const db = createServiceClient();
    const deps = await buildServiceDeps();
    const bundle = await deps.repo.getReportBundleById(id);
    if (!bundle) return errorJson(404, "not_found", "Report not found.");

    if (action === "revoke") {
      await db.from("reports").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }
    if (action === "rotate_link") {
      // Old links stop working; the new link is shown once to the admin to send to the lead.
      const token = generateReportToken();
      const expires = new Date(Date.now() + serverEnv().reportTokenTtlDays * 86_400_000).toISOString();
      await deps.repo.rotateReportToken(id, hashToken(token), expires);
      return json({ ok: true, reportUrl: `${publicEnv.siteUrl}/report/${token}` });
    }
    // rescan
    await db.from("assessments").update({ status: "queued", attempts: 0, error_message: null }).eq("id", bundle.assessment.id);
    await db.from("reports").update({ status: "pending" }).eq("id", id);
    const fresh = await deps.repo.getReportBundleById(id);
    const result = await runAssessmentForBundle(fresh!, null, deps);
    return json({ ok: true, status: result.status });
  } catch (e) {
    return handleError(e, "admin/reports");
  }
}
