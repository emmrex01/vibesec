import { listLeads } from "@/lib/admin/queries";
import { requireAdminApi } from "@/lib/auth/admin";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  try {
    const p = new URL(req.url).searchParams;
    const result = await listLeads({
      q: p.get("q") ?? undefined,
      status: p.get("status") ?? undefined,
      priority: p.get("priority") ?? undefined,
      country: p.get("country") ?? undefined,
      platform: p.get("platform") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
      result: p.get("result") ?? undefined,
      page: Number(p.get("page") ?? 1) || 1,
    });
    return json({ ok: true, ...result });
  } catch (e) {
    return handleError(e, "admin/leads");
  }
}
