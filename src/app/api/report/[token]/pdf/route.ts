import { publicEnv } from "@/config/env";
import { clientIp, errorJson, handleError } from "@/lib/http";
import { generateReportPdf } from "@/lib/pdf/report-pdf";
import { LIMITS } from "@/lib/rate-limit";
import { buildReportViewModel } from "@/lib/reports/view-model";
import { hashIp } from "@/lib/security/tokens";
import { loadBundleForToken } from "@/lib/services/assessment-service";
import { buildServiceDeps } from "@/lib/services/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const deps = await buildServiceDeps();
    if (!(await deps.limiter.limit(`report:ip:${hashIp(clientIp(req), deps.ipSalt)}`, LIMITS.reportPerIp.max, LIMITS.reportPerIp.windowSeconds))) {
      return errorJson(429, "rate_limited", "Too many requests. Please wait a moment.");
    }
    const bundle = await loadBundleForToken(token, deps);
    if (bundle.assessment.status !== "completed") return errorJson(409, "not_ready", "The report is not ready yet.");
    const pdf = await generateReportPdf(buildReportViewModel(bundle), deps.settings, {
      website: deps.settings.websiteUrl,
      email: deps.settings.contactEmail,
      whatsapp: deps.settings.whatsappNumber,
      consultationUrl: `${publicEnv.siteUrl}/contact?source=report`,
    });
    await deps.repo.recordPdfDownload(bundle.report.id);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${bundle.report.report_number}.pdf"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    return handleError(e, "report/pdf");
  }
}
