import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/config/env";
import { errorJson, handleError, json } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily data-retention job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(req: Request) {
  const secret = serverEnv().cronSecret;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return errorJson(401, "unauthorized", "Unauthorized.");
  }
  try {
    const settings = await getSettings();
    const cutoff = new Date(Date.now() - settings.leadRetentionDays * 86_400_000).toISOString();
    const db = createServiceClient();
    const leads = await db.from("leads").delete().lt("created_at", cutoff).select("id");
    const consultations = await db.from("consultation_requests").delete().lt("created_at", cutoff).select("id");
    const limits = await db.from("scan_rate_limits").delete().lt("window_start", new Date(Date.now() - 2 * 86_400_000).toISOString());
    if (leads.error || consultations.error || limits.error) throw new Error("retention delete failed");
    return json({ ok: true, deletedLeads: leads.data?.length ?? 0, deletedConsultations: consultations.data?.length ?? 0, retentionDays: settings.leadRetentionDays });
  } catch (e) {
    return handleError(e, "cron/retention");
  }
}
