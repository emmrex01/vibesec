import "server-only";
import { cache } from "react";
import { defaultSettings, type ServiceItem, type SiteSettings } from "@/config/defaults";
import { isSupabaseConfigured } from "@/config/env";
import { createServiceClient } from "@/lib/supabase/admin";

type Row = {
  business_name: string | null;
  logo_url: string | null;
  contact_email: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  booking_url: string | null;
  services: ServiceItem[] | null;
  assessment_disclaimer: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  report_brand_color: string | null;
  lead_retention_days: number | null;
};

/** DB settings override env defaults; any missing value falls back to the environment configuration. */
export function mergeSettings(row: Partial<Row> | null): SiteSettings {
  const d = defaultSettings();
  if (!row) return d;
  return {
    businessName: row.business_name || d.businessName,
    logoUrl: row.logo_url || d.logoUrl,
    contactEmail: row.contact_email || d.contactEmail,
    whatsappNumber: row.whatsapp_number || d.whatsappNumber,
    websiteUrl: row.website_url || d.websiteUrl,
    bookingUrl: row.booking_url || d.bookingUrl,
    services: Array.isArray(row.services) && row.services.length ? row.services : d.services,
    assessmentDisclaimer: row.assessment_disclaimer || d.assessmentDisclaimer,
    emailFromName: row.email_from_name || d.emailFromName,
    emailFromAddress: row.email_from_address || d.emailFromAddress,
    reportBrandColor: row.report_brand_color || d.reportBrandColor,
    leadRetentionDays: row.lead_retention_days ?? d.leadRetentionDays,
  };
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (!isSupabaseConfigured()) return defaultSettings();
  try {
    const { data, error } = await createServiceClient().from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return mergeSettings(data as Row | null);
  } catch {
    return defaultSettings();
  }
});
