import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorJson, handleError, json, readJson } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";
import { CONSULTATION_STATUSES } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const id = z.uuid().parse((await params).id);
    const { status } = z.object({ status: z.enum(CONSULTATION_STATUSES) }).parse(await readJson(req));
    const { data, error } = await createServiceClient().from("consultation_requests").update({ status }).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error("update consultation failed");
    if (!data) return errorJson(404, "not_found", "Request not found.");
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "admin/consultations");
  }
}
