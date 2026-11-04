import type { SafeFetchResult } from "@/lib/security/safe-fetch";
import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check, clip, header, type Outcome } from "./util";

const ACTIVE_TAGS = new Set(["script", "iframe", "embed", "object", "form"]);
const PASSIVE_TAGS = new Set(["img", "audio", "video", "source"]);

export function findMixedContent(html: string): { active: string[]; passive: string[] } {
  const active = new Set<string>();
  const passive = new Set<string>();
  const tagRe = /<(script|iframe|img|link|audio|video|source|embed|object|form)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = tagRe.exec(html)) && guard++ < 5000) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const urlMatch = /\s(?:src|href|action|data)\s*=\s*["']?\s*(http:\/\/[^"'\s>]+)/i.exec(attrs);
    if (!urlMatch) continue;
    const url = urlMatch[1].slice(0, 200);
    if (tag === "link") {
      const rel = /\srel\s*=\s*["']?([^"'>]+)/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
      if (/stylesheet|preload|modulepreload/.test(rel)) active.add(url);
      else if (/icon|manifest/.test(rel)) passive.add(url);
    } else if (ACTIVE_TAGS.has(tag)) active.add(url);
    else if (PASSIVE_TAGS.has(tag)) passive.add(url);
  }
  return { active: [...active].slice(0, 20), passive: [...passive].slice(0, 20) };
}

/** Module F — basic website configuration (homepage only). */
export function analyzeWebsite(httpsResult: Outcome<SafeFetchResult>): { checks: CheckResult[]; findings: Finding[]; html: string | null } {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const cat = "website" as const;

  if (!httpsResult.ok) {
    const reason = "The homepage could not be retrieved, so this check was not performed.";
    checks.push(check("page_available", cat, "Homepage availability", 6, "unavailable", reason, { error: httpsResult.error }));
    checks.push(check("redirect_behavior", cat, "Redirect behaviour", 2, "unavailable", reason));
    checks.push(check("server_disclosure", cat, "Server version disclosure", 4, "unavailable", reason));
    checks.push(check("powered_by", cat, "X-Powered-By disclosure", 2, "unavailable", reason));
    checks.push(check("mixed_content", cat, "Mixed content", 6, "unavailable", reason));
    return { checks, findings, html: null };
  }

  const res = httpsResult.value;
  const h = res.headers;

  // Availability (6)
  if ((res.status >= 200 && res.status < 300) || res.status === 401 || res.status === 403) {
    checks.push(check("page_available", cat, "Homepage availability", 6, "pass", `Homepage responded with status ${res.status}.`, { status: res.status }));
  } else {
    checks.push(check("page_available", cat, "Homepage availability", 6, "warn", `Homepage responded with status ${res.status}.`, { status: res.status }, 3));
    findings.push(makeFinding("page_unexpected_status", `The homepage returned HTTP ${res.status}.`, { status: res.status }));
  }

  // Redirect behaviour (2)
  const redirects = res.hops.length - 1;
  const chain = res.hops.map((hop) => `${hop.status} ${hop.url}`);
  if (redirects > 3) {
    checks.push(check("redirect_behavior", cat, "Redirect behaviour", 2, "warn", `${redirects} redirects before reaching the homepage.`, { chain }, 1));
    findings.push(makeFinding("redirect_chain_long", `${redirects} redirects were followed.`, { chain }));
  } else {
    checks.push(check("redirect_behavior", cat, "Redirect behaviour", 2, "pass", redirects ? `${redirects} redirect(s), all validated.` : "No redirects.", { chain }));
  }

  // Server disclosure (4)
  const server = header(h, "server");
  const aspnet = header(h, "x-aspnet-version") ?? header(h, "x-aspnetmvc-version");
  const versioned = (server && /\/\s*\d+(\.\d+)*/.test(server)) || !!aspnet;
  const serverEv = { server: clip(server, 120), aspnet: clip(aspnet, 60) };
  if (versioned) {
    checks.push(check("server_disclosure", cat, "Server version disclosure", 4, "fail", "Software version numbers are disclosed in headers.", serverEv));
    findings.push(makeFinding("server_version_disclosure", `Disclosed: ${[server, aspnet && `ASP.NET ${aspnet}`].filter(Boolean).join("; ")}.`, serverEv));
  } else {
    checks.push(check("server_disclosure", cat, "Server version disclosure", 4, "pass", server ? `Server header present without version (${clip(server, 40)}).` : "No version information disclosed.", serverEv));
  }

  // X-Powered-By (2)
  const powered = header(h, "x-powered-by");
  if (powered) {
    checks.push(check("powered_by", cat, "X-Powered-By disclosure", 2, "fail", `X-Powered-By: ${clip(powered, 60)}.`, { xPoweredBy: clip(powered, 120) }));
    findings.push(makeFinding("powered_by_disclosure", `X-Powered-By: ${clip(powered, 80)}.`, { xPoweredBy: clip(powered, 120) }));
  } else {
    checks.push(check("powered_by", cat, "X-Powered-By disclosure", 2, "pass", "Header not present."));
  }

  // Mixed content (6)
  const contentType = header(h, "content-type") ?? "";
  const isHtml = /text\/html|application\/xhtml/i.test(contentType) || /^\s*<(!doctype|html)/i.test(res.body.subarray(0, 200).toString("utf8"));
  const html = isHtml ? res.body.toString("utf8") : null;
  if (!res.finalUrl.startsWith("https:")) {
    checks.push(check("mixed_content", cat, "Mixed content", 6, "not_applicable", "Final page is not served over HTTPS."));
  } else if (!html) {
    checks.push(check("mixed_content", cat, "Mixed content", 6, "not_applicable", "Homepage did not return HTML.", { contentType: clip(contentType, 80) }));
  } else {
    const mixed = findMixedContent(html);
    const ev = { activeResources: mixed.active, passiveResources: mixed.passive, truncatedBody: res.truncated };
    if (mixed.active.length) {
      checks.push(check("mixed_content", cat, "Mixed content", 6, "fail", `${mixed.active.length} active HTTP resource reference(s).`, ev));
      findings.push(makeFinding("mixed_content_active", `HTTP references: ${mixed.active.slice(0, 3).join(", ")}.`, ev));
    } else if (mixed.passive.length) {
      checks.push(check("mixed_content", cat, "Mixed content", 6, "warn", `${mixed.passive.length} passive HTTP resource reference(s).`, ev, 4));
      findings.push(makeFinding("mixed_content_passive", `HTTP references: ${mixed.passive.slice(0, 3).join(", ")}.`, ev));
    } else {
      checks.push(check("mixed_content", cat, "Mixed content", 6, "pass", "No insecure resource references found in the homepage HTML.", ev));
    }
  }

  return { checks, findings, html };
}
