import { requireAdminApi } from "@/lib/auth/admin";
import { handleError, json, readJson } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const admin = await requireAdminApi(req, { mutation: true });
  if (admin instanceof Response) return admin;
  try {
    const s = settingsSchema.parse(await readJson(req));
    const { error } = await createServiceClient()
      .from("app_settings")
      .update({
        business_name: s.businessName,
        logo_url: s.logoUrl || null,
        contact_email: s.contactEmail || null,
        whatsapp_number: s.whatsappNumber || null,
        website_url: s.websiteUrl || null,
        booking_url: s.bookingUrl || null,
        assessment_disclaimer: s.assessmentDisclaimer || null,
        email_from_name: s.emailFromName || null,
        email_from_address: s.emailFromAddress || null,
        report_brand_color: s.reportBrandColor,
        lead_retention_days: s.leadRetentionDays,
        services: s.services,
        updated_by: admin.id,
      })
      .eq("id", 1);
    if (error) throw new Error("update settings failed");
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "admin/settings");
  }
}
