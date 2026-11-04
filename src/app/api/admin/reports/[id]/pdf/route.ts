import { z } from "zod";
import { publicEnv } from "@/config/env";
import { requireAdminApi } from "@/lib/auth/admin";
import { errorJson, handleError } from "@/lib/http";
import { generateReportPdf } from "@/lib/pdf/report-pdf";
import { buildReportViewModel } from "@/lib/reports/view-model";
import { buildServiceDeps } from "@/lib/services/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  try {
    const id = z.uuid().parse((await params).id);
    const deps = await buildServiceDeps();
    const bundle = await deps.repo.getReportBundleById(id);
    if (!bundle) return errorJson(404, "not_found", "Report not found.");
    if (bundle.assessment.status !== "completed") return errorJson(409, "not_ready", "The assessment has not completed.");
    const pdf = await generateReportPdf(buildReportViewModel(bundle), deps.settings, {
      website: deps.settings.websiteUrl,
      email: deps.settings.contactEmail,
      whatsapp: deps.settings.whatsappNumber,
      consultationUrl: `${publicEnv.siteUrl}/contact?source=report`,
    });
    return new Response(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${bundle.report.report_number}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return handleError(e, "admin/reports/pdf");
  }
}
