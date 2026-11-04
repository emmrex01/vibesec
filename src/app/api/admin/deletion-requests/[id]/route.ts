import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorJson, handleError, json, readJson } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * complete → permanently deletes every lead (and cascaded assessments, reports, notes, consents)
 *            and consultation request for the requester's email address.
 * reject   → marks the request rejected (e.g. identity could not be confirmed).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const id = z.uuid().parse((await params).id);
    const { action } = z.object({ action: z.enum(["complete", "reject"]) }).parse(await readJson(req));
    const db = createServiceClient();
    const { data: request } = await db.from("data_deletion_requests").select("id, email, status").eq("id", id).maybeSingle();
    if (!request) return errorJson(404, "not_found", "Request not found.");

    let deletedLeads = 0;
    if (action === "complete") {
      const email = String(request.email).toLowerCase();
      const leads = await db.from("leads").delete().eq("email", email).select("id");
      const consultations = await db.from("consultation_requests").delete().eq("email", email).select("id");
      if (leads.error || consultations.error) throw new Error("deletion failed");
      deletedLeads = leads.data?.length ?? 0;
    }
    await db
      .from("data_deletion_requests")
      .update({ status: action === "complete" ? "completed" : "rejected", processed_at: new Date().toISOString(), processed_by: admin.id })
      .eq("id", id);
    return json({ ok: true, deletedLeads });
  } catch (e) {
    return handleError(e, "admin/deletion-requests");
  }
}
