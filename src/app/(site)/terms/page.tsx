import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <div className="container max-w-3xl py-16 sm:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <div className="prose-legal">
        <h2>1. The service</h2>
        <p>{s.businessName} Security Health provides a free, preliminary, automated review of publicly observable website configuration (the &quot;Service&quot;). It is informational only and is described further in our <Link className="text-cyan-400" href="/disclaimer">Assessment Disclaimer</Link>.</p>
        <h2>2. Authorization</h2>
        <p>You may only request an assessment of a website that you own or that you are authorized by its owner to have assessed. By submitting a request you confirm this authorization. Misuse of the Service to assess third-party websites without permission is prohibited and may be reported.</p>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Do not attempt to use the Service to reach private, internal or non-public systems.</li>
          <li>Do not automate submissions, circumvent rate limits or bot protection, or interfere with the Service.</li>
          <li>Do not submit false information about yourself or your organisation.</li>
        </ul>
        <h2>4. No warranty</h2>
        <p>The Service is provided &quot;as is&quot;. Results may be incomplete or affected by network conditions, firewalls or configuration changes. A score or report does not certify that a website is secure or insecure.</p>
        <h2>5. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, {s.businessName} is not liable for any indirect or consequential loss arising from use of the Service or reliance on its results. Nothing in these terms limits liability that cannot be limited by law.</p>
        <h2>6. Professional services</h2>
        <p>Paid assessments, reviews and remediation are provided under a separate written agreement that defines scope and authorization.</p>
        <h2>7. Changes</h2>
        <p>We may update these terms. The version published on this page applies to each assessment request at the time it is made.</p>
      </div>
    </div>
  );
}
