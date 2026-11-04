import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorJson, handleError, json, readJson } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";
import { leadUpdateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.uuid();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const id = idSchema.parse((await params).id);
    const body = leadUpdateSchema.parse(await readJson(req));
    const db = createServiceClient();
    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.priority) patch.priority = body.priority;
    if (body.owner !== undefined) patch.owner = body.owner || null;
    if (body.salesNotes !== undefined) patch.sales_notes = body.salesNotes || null;
    if (Object.keys(patch).length) {
      const { data, error } = await db.from("leads").update(patch).eq("id", id).select("id").maybeSingle();
      if (error) throw new Error("update lead failed");
      if (!data) return errorJson(404, "not_found", "Lead not found.");
    }
    if (body.note) {
      const { error } = await db.from("admin_notes").insert({ lead_id: id, author_id: admin.id, author_email: admin.email, body: body.note });
      if (error) throw new Error("insert note failed");
    }
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "admin/leads/patch");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const id = idSchema.parse((await params).id);
    const { data, error } = await createServiceClient().from("leads").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw new Error("delete lead failed");
    if (!data) return errorJson(404, "not_found", "Lead not found.");
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "admin/leads/delete");
  }
}
