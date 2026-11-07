import type { Metadata } from "next";
import { SCORE_DISCLAIMER } from "@/lib/scoring/score";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Security Assessment Disclaimer" };

export default async function DisclaimerPage() {
  const s = await getSettings();
  return (
    <div className="container max-w-3xl py-16 sm:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Security Assessment Disclaimer</h1>
      <div className="prose-legal">
        <p className="mt-6 rounded-lg border border-sev-medium/30 bg-sev-medium/5 p-4 text-foreground">{SCORE_DISCLAIMER}</p>
        <p>{s.assessmentDisclaimer}</p>
        <h2>What the automated check does</h2>
        <ul>
          <li>Connects to your public homepage over HTTPS and HTTP and records the response status and headers.</li>
          <li>Performs a TLS handshake to inspect the certificate presented for your domain.</li>
          <li>Performs standard DNS lookups (A, AAAA, MX, TXT, DMARC, DS).</li>
          <li>Reads the homepage HTML to identify insecure resource references and passive technology indicators.</li>
        </ul>
        <h2>What it never does</h2>
        <ul>
          <li>Exploit vulnerabilities, inject payloads or attempt authentication bypass.</li>
          <li>Brute-force passwords, enumerate accounts, submit forms or upload files.</li>
          <li>Crawl your site, access authenticated or private areas, or scan ports.</li>
          <li>Execute JavaScript returned by your website.</li>
        </ul>
        <h2>Interpreting results</h2>
        <p>A finding means a configuration was observed that may warrant attention — not that your website has been hacked, breached or compromised. Missing headers or DNS records do not by themselves prove an exploitable vulnerability. Severity ratings are deliberately conservative.</p>
        <p>Technology indicators are inferred from public signals and do not confirm how a site was developed.</p>
      </div>
    </div>
  );
}
