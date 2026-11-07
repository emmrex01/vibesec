import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Security Health Report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, settings] = await Promise.all([params, getSettings()]);
  return (
    <div className="container max-w-5xl">
      <ReportView
        token={token.slice(0, 64)}
        contact={{ businessName: settings.businessName, email: settings.contactEmail, whatsapp: settings.whatsappNumber, bookingUrl: settings.bookingUrl }}
      />
    </div>
  );
}
