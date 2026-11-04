import { listAssessments } from "@/lib/admin/queries";
import { requireAdminApi } from "@/lib/auth/admin";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  try {
    const p = new URL(req.url).searchParams;
    return json({ ok: true, ...(await listAssessments(Number(p.get("page") ?? 1) || 1, p.get("status") ?? undefined)) });
  } catch (e) {
    return handleError(e, "admin/assessments");
  }
}
