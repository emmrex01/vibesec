import type { Metadata } from "next";
import { DeletionRequestForm } from "@/components/forms/deletion-request-form";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const s = await getSettings();
  const contact = s.contactEmail ? <a className="text-cyan-400" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> : "the contact details on our Contact page";
  return (
    <div className="container max-w-3xl py-16 sm:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">This policy explains how {s.businessName} handles personal information collected through the Security Health service.</p>
      <div className="prose-legal">
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Contact details you provide:</strong> name, business email, company, job title (optional), country and company website (optional).</li>
          <li><strong>Assessment details:</strong> the website address you submit, the platform and application context you choose to share, and the results of the automated checks.</li>
          <li><strong>Consent records:</strong> your confirmation that you are authorized to request the assessment, your acknowledgement of this notice, and whether you opted in to marketing — with timestamps.</li>
          <li><strong>Technical data:</strong> a salted, one-way hash of your IP address and your browser user-agent, used for abuse prevention and consent records.</li>
        </ul>
        <p>We never ask for passwords, credentials, payment card data or your customers&apos; records. The scanner records cookie <em>attributes</em> from your homepage, never cookie values.</p>

        <h2>Why we use it</h2>
        <ul>
          <li>To perform the assessment you requested and deliver your report (performance of your request).</li>
          <li>To respond to consultation requests and follow up about your assessment (legitimate interests).</li>
          <li>To prevent abuse of the service, such as automated or unauthorized scanning (legitimate interests).</li>
          <li>To send occasional security insights and service updates — <strong>only if you separately opt in</strong> (consent). You can withdraw consent at any time.</li>
        </ul>

        <h2>Sharing</h2>
        <p>We do not sell your information or share lead records with unrelated third parties. We use service providers to operate the platform — hosting (Vercel), database and authentication (Supabase), transactional email (Resend), bot protection (Cloudflare Turnstile) and rate limiting (Upstash) — under their data processing terms.</p>

        <h2>International transfers</h2>
        <p>The service is available internationally. Our providers may process data in countries other than yours; where required we rely on appropriate safeguards such as standard contractual clauses.</p>

        <h2>Retention</h2>
        <p>Lead, assessment and consultation records are kept for {s.leadRetentionDays} days and then deleted automatically, unless you become a customer or ask us to delete them sooner. Report links expire automatically.</p>

        <h2 id="cookies">Cookies</h2>
        <p>The public website does not use advertising or analytics cookies. Essential cookies are used only for administrator sign-in and, where enabled, by Cloudflare Turnstile for bot protection. A small browser storage entry remembers that you dismissed the cookie notice.</p>

        <h2>Your rights</h2>
        <p>Depending on where you live, you may have rights to access, correct, delete or restrict the use of your information, to object to processing, and to complain to a data protection authority. Contact us at {contact} or use the form below.</p>

        <h2 id="deletion">Request deletion of your data</h2>
        <p>Submit the email address you used. We may contact you at that address to confirm the request before deleting your leads, assessments, reports and consultation requests.</p>
      </div>
      <Card className="mt-6 p-6">
        <DeletionRequestForm />
      </Card>
    </div>
  );
}
