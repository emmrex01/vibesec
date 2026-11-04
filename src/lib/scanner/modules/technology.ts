import type { CheckResult, TechnologyObservation } from "../types";
import { check, header } from "./util";

type Headers = Record<string, string | string[] | undefined>;

interface Rule {
  name: string;
  kind: TechnologyObservation["kind"];
  confidence: TechnologyObservation["confidence"];
  test: (ctx: { host: string; headers: Headers; html: string }) => string | null;
}

const has = (html: string, needle: RegExp, label: string) => (needle.test(html) ? label : null);

const RULES: Rule[] = [
  { name: "Vercel", kind: "hosting", confidence: "high", test: ({ headers }) => (header(headers, "x-vercel-id") ? "x-vercel-id response header" : /vercel/i.test(header(headers, "server") ?? "") ? "Server: Vercel" : null) },
  { name: "Cloudflare", kind: "cdn", confidence: "high", test: ({ headers }) => (header(headers, "cf-ray") ? "cf-ray response header" : null) },
  { name: "Netlify", kind: "hosting", confidence: "high", test: ({ headers }) => (header(headers, "x-nf-request-id") ? "x-nf-request-id response header" : /netlify/i.test(header(headers, "server") ?? "") ? "Server: Netlify" : null) },
  { name: "Amazon CloudFront", kind: "cdn", confidence: "high", test: ({ headers }) => (header(headers, "x-amz-cf-id") ? "x-amz-cf-id response header" : null) },
  { name: "Fastly", kind: "cdn", confidence: "medium", test: ({ headers }) => (/fastly/i.test(header(headers, "x-served-by") ?? "") || header(headers, "x-fastly-request-id") ? "Fastly request headers" : null) },
  { name: "GitHub Pages", kind: "hosting", confidence: "high", test: ({ headers }) => (/github\.com/i.test(header(headers, "server") ?? "") ? "Server: GitHub.com" : null) },
  { name: "Fly.io", kind: "hosting", confidence: "high", test: ({ headers }) => (header(headers, "fly-request-id") ? "fly-request-id response header" : null) },
  { name: "Render", kind: "hosting", confidence: "medium", test: ({ headers }) => (header(headers, "rndr-id") ? "rndr-id response header" : null) },
  { name: "Google Cloud", kind: "hosting", confidence: "medium", test: ({ headers }) => (/google frontend/i.test(header(headers, "server") ?? "") ? "Server: Google Frontend" : null) },
  { name: "Next.js", kind: "framework", confidence: "high", test: ({ headers, html }) => (/next\.js/i.test(header(headers, "x-powered-by") ?? "") ? "X-Powered-By: Next.js" : has(html, /__NEXT_DATA__|\/_next\/static\//, "Next.js asset paths in HTML")) },
  { name: "Nuxt", kind: "framework", confidence: "medium", test: ({ html }) => has(html, /__NUXT__|\/_nuxt\//, "Nuxt asset paths in HTML") },
  { name: "Vite single-page app", kind: "framework", confidence: "low", test: ({ html }) => has(html, /<script[^>]+type=["']module["'][^>]+src=["'][^"']*\/assets\/index-[\w-]+\.js/i, "Vite-style hashed module bundle") },
  { name: "WordPress", kind: "cms", confidence: "high", test: ({ html }) => has(html, /\/wp-content\/|\/wp-includes\/|<meta[^>]+generator[^>]+WordPress/i, "WordPress paths or generator tag") },
  { name: "Shopify", kind: "ecommerce", confidence: "high", test: ({ headers, html }) => (header(headers, "x-shopid") ? "x-shopid response header" : has(html, /cdn\.shopify\.com|Shopify\.theme/, "Shopify CDN references")) },
  { name: "Webflow", kind: "cms", confidence: "high", test: ({ html }) => has(html, /data-wf-site=|website-files\.com|webflow\.js/i, "Webflow markup") },
  { name: "Wix", kind: "cms", confidence: "high", test: ({ html }) => has(html, /static\.wixstatic\.com|wix-bolt|X-Wix/i, "Wix asset references") },
  { name: "Squarespace", kind: "cms", confidence: "high", test: ({ html }) => has(html, /static1\.squarespace\.com|Squarespace\./, "Squarespace asset references") },
  { name: "Framer", kind: "builder", confidence: "high", test: ({ html }) => has(html, /framerusercontent\.com|<meta[^>]+generator[^>]+Framer/i, "Framer asset references") },
  { name: "Supabase (public client reference)", kind: "backend", confidence: "medium", test: ({ html }) => has(html, /[a-z0-9]{20}\.supabase\.co/i, "Reference to a *.supabase.co project URL in the homepage") },
  { name: "Firebase", kind: "backend", confidence: "medium", test: ({ html }) => has(html, /firebaseapp\.com|firebaseio\.com|firebasestorage\.googleapis\.com/i, "Firebase references in the homepage") },
  { name: "Lovable (indicator)", kind: "builder", confidence: "low", test: ({ host, html }) => (/\.lovable\.app$/.test(host) ? "Hosted on *.lovable.app" : has(html, /lovable\.dev|gptengineer\.js|lovable-tagger/i, "Lovable-related markup")) },
  { name: "Replit (indicator)", kind: "builder", confidence: "low", test: ({ host, html }) => (/\.(replit\.app|repl\.co)$/.test(host) ? "Hosted on Replit domain" : has(html, /replit\.com\/public\/js|\.replit\.dev/i, "Replit-related markup")) },
  { name: "Base44 (indicator)", kind: "builder", confidence: "low", test: ({ host, html }) => (/\.base44\.app$/.test(host) ? "Hosted on *.base44.app" : has(html, /base44/i, "Base44-related markup")) },
  { name: "Bolt.new (indicator)", kind: "builder", confidence: "low", test: ({ host, html }) => (/\.bolt\.host$/.test(host) ? "Hosted on *.bolt.host" : has(html, /bolt\.new/i, "Bolt-related markup")) },
];

/**
 * Module G — technology identification from passive, public signals only.
 * Results are *indicators*; they never confirm how a site was developed.
 */
export function detectTechnologies(host: string, headers: Headers | null, html: string | null): { observations: TechnologyObservation[]; check: CheckResult } {
  const ctx = { host, headers: headers ?? {}, html: (html ?? "").slice(0, 1_500_000) };
  const observations: TechnologyObservation[] = [];
  for (const rule of RULES) {
    const evidence = rule.test(ctx);
    if (evidence) observations.push({ name: rule.name, kind: rule.kind, confidence: rule.confidence, evidence });
  }
  return {
    observations,
    check: check(
      "technology_observed",
      "technology",
      "Technology indicators",
      0,
      headers ? "info" : "unavailable",
      headers
        ? observations.length
          ? `Detected indicators: ${observations.map((o) => o.name).join(", ")}. These are passive indicators, not confirmed development history.`
          : "No specific technology indicators detected."
        : "No response available to inspect.",
      { observations },
    ),
  };
}
