import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check, clip, header } from "./util";

type Headers = Record<string, string | string[] | undefined>;

export const HEADER_PURPOSES: Record<string, string> = {
  "strict-transport-security": "Forces browsers to use HTTPS for future visits.",
  "content-security-policy": "Restricts where scripts, styles and other resources may load from; limits the impact of XSS.",
  "x-content-type-options": "Prevents browsers from MIME-sniffing responses into executable content.",
  "x-frame-options": "Prevents other sites from framing this site (clickjacking).",
  "referrer-policy": "Limits how much URL information is shared with other sites.",
  "permissions-policy": "Restricts access to powerful browser features such as camera or geolocation.",
  "cross-origin-opener-policy": "Isolates this site's window from cross-origin windows.",
};

export function parseCsp(value: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    if (!map.has(name)) map.set(name, tokens.slice(1));
  }
  return map;
}

export function cspWeaknesses(csp: Map<string, string[]>): string[] {
  const issues: string[] = [];
  const scriptSrc = csp.get("script-src") ?? csp.get("default-src");
  if (!scriptSrc) issues.push("no script-src or default-src directive");
  else {
    const hasNonceOrHash = scriptSrc.some((s) => /^'(nonce-|sha256-|sha384-|sha512-)/i.test(s));
    const strictDynamic = scriptSrc.includes("'strict-dynamic'");
    if (scriptSrc.includes("'unsafe-inline'") && !hasNonceOrHash && !strictDynamic) issues.push("scripts allow 'unsafe-inline'");
    if (scriptSrc.some((s) => s === "*" || s === "http:" || s === "https:" || s === "data:")) issues.push("scripts allow wildcard or broad scheme sources");
  }
  if (csp.get("default-src")?.includes("*")) issues.push("default-src allows any origin");
  return issues;
}

/** Module B — security headers, evaluated on the final HTTPS homepage response. */
export function analyzeHeaders(headers: Headers | null, unavailableReason?: string): { checks: CheckResult[]; findings: Finding[] } {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const cat = "security_headers" as const;

  if (!headers) {
    const defs: [string, string, number][] = [
      ["hsts", "Strict-Transport-Security", 6],
      ["csp", "Content-Security-Policy", 6],
      ["x_content_type_options", "X-Content-Type-Options", 3],
      ["framing_protection", "Clickjacking protection", 4],
      ["referrer_policy", "Referrer-Policy", 3],
      ["permissions_policy", "Permissions-Policy", 2],
      ["coop", "Cross-Origin-Opener-Policy", 1],
    ];
    for (const [k, t, p] of defs) checks.push(check(k, cat, t, p, "unavailable", unavailableReason ?? "No HTTPS response available to inspect."));
    return { checks, findings };
  }

  // HSTS (6)
  const hsts = header(headers, "strict-transport-security");
  const hstsEv = { header: clip(hsts), purpose: HEADER_PURPOSES["strict-transport-security"] };
  if (!hsts) {
    checks.push(check("hsts", cat, "Strict-Transport-Security", 6, "fail", "Header missing.", hstsEv));
    findings.push(makeFinding("hsts_missing", "No Strict-Transport-Security header on the HTTPS homepage.", hstsEv));
  } else {
    const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? NaN);
    if (!Number.isFinite(maxAge) || maxAge <= 0) {
      checks.push(check("hsts", cat, "Strict-Transport-Security", 6, "fail", "Header present but max-age is missing or zero.", hstsEv));
      findings.push(makeFinding("hsts_missing", `HSTS header present with ineffective value: ${clip(hsts, 120)}`, hstsEv));
    } else if (maxAge < 15552000) {
      checks.push(check("hsts", cat, "Strict-Transport-Security", 6, "warn", `Present with short max-age (${maxAge}s).`, { ...hstsEv, maxAge }, 3));
      findings.push(makeFinding("hsts_weak", `HSTS max-age is ${maxAge} seconds.`, { ...hstsEv, maxAge }));
    } else {
      checks.push(check("hsts", cat, "Strict-Transport-Security", 6, "pass", `Present (max-age ${maxAge}s).`, { ...hstsEv, maxAge }));
    }
  }

  // CSP (6)
  const cspValue = header(headers, "content-security-policy");
  const cspRO = header(headers, "content-security-policy-report-only");
  const cspEv = { header: clip(cspValue, 500), reportOnly: clip(cspRO, 200), purpose: HEADER_PURPOSES["content-security-policy"] };
  const parsedCsp = cspValue ? parseCsp(cspValue) : null;
  if (!cspValue) {
    if (cspRO) {
      checks.push(check("csp", cat, "Content-Security-Policy", 6, "warn", "Only a Report-Only policy is set (not enforced).", cspEv, 2));
    } else {
      checks.push(check("csp", cat, "Content-Security-Policy", 6, "fail", "Header missing.", cspEv));
    }
    findings.push(makeFinding("csp_missing", cspRO ? "Only Content-Security-Policy-Report-Only is set; no policy is enforced." : "No Content-Security-Policy header on the homepage.", cspEv));
  } else {
    const weak = cspWeaknesses(parsedCsp!);
    if (weak.length) {
      checks.push(check("csp", cat, "Content-Security-Policy", 6, "warn", `Present but potentially weak: ${weak.join("; ")}.`, { ...cspEv, issues: weak }, 3));
      findings.push(makeFinding("csp_weak", `CSP observations: ${weak.join("; ")}.`, { ...cspEv, issues: weak }));
    } else {
      checks.push(check("csp", cat, "Content-Security-Policy", 6, "pass", "Present.", cspEv));
    }
  }

  // X-Content-Type-Options (3)
  const xcto = header(headers, "x-content-type-options");
  const xctoEv = { header: clip(xcto), purpose: HEADER_PURPOSES["x-content-type-options"] };
  if (xcto?.toLowerCase().includes("nosniff")) {
    checks.push(check("x_content_type_options", cat, "X-Content-Type-Options", 3, "pass", "Set to nosniff.", xctoEv));
  } else {
    checks.push(check("x_content_type_options", cat, "X-Content-Type-Options", 3, "fail", xcto ? "Present with an unexpected value." : "Header missing.", xctoEv));
    findings.push(makeFinding("xcto_missing", xcto ? `Unexpected value: ${clip(xcto, 80)}` : "No X-Content-Type-Options header.", xctoEv));
  }

  // Framing (4)
  const xfo = header(headers, "x-frame-options");
  const frameAncestors = parsedCsp?.get("frame-ancestors");
  const frameEv = { xFrameOptions: clip(xfo), frameAncestors: frameAncestors?.join(" "), purpose: HEADER_PURPOSES["x-frame-options"] };
  if (frameAncestors || /^(deny|sameorigin)$/i.test(xfo?.trim() ?? "")) {
    checks.push(check("framing_protection", cat, "Clickjacking protection", 4, "pass", frameAncestors ? "CSP frame-ancestors is set." : `X-Frame-Options: ${xfo}.`, frameEv));
  } else if (xfo && /allow-from/i.test(xfo)) {
    checks.push(check("framing_protection", cat, "Clickjacking protection", 4, "warn", "X-Frame-Options uses obsolete ALLOW-FROM.", frameEv, 1));
    findings.push(makeFinding("framing_weak", `X-Frame-Options: ${clip(xfo, 80)}`, frameEv));
  } else {
    checks.push(check("framing_protection", cat, "Clickjacking protection", 4, "fail", "No X-Frame-Options or frame-ancestors.", frameEv));
    findings.push(makeFinding("framing_missing", "Neither X-Frame-Options nor CSP frame-ancestors is set.", frameEv));
  }

  // Referrer-Policy (3)
  const ref = header(headers, "referrer-policy");
  const refEv = { header: clip(ref), purpose: HEADER_PURPOSES["referrer-policy"] };
  const refTokens = (ref ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const effective = refTokens[refTokens.length - 1];
  if (!ref) {
    checks.push(check("referrer_policy", cat, "Referrer-Policy", 3, "warn", "Not set (browser default applies).", refEv, 1.5));
    findings.push(makeFinding("referrer_missing", "No Referrer-Policy header.", refEv));
  } else if (effective === "unsafe-url" || effective === "no-referrer-when-downgrade") {
    checks.push(check("referrer_policy", cat, "Referrer-Policy", 3, "warn", `Set to ${effective}.`, refEv, 1));
    findings.push(makeFinding("referrer_weak", `Referrer-Policy: ${effective}.`, refEv));
  } else {
    checks.push(check("referrer_policy", cat, "Referrer-Policy", 3, "pass", `Set to ${effective}.`, refEv));
  }

  // Permissions-Policy (2)
  const pp = header(headers, "permissions-policy") ?? header(headers, "feature-policy");
  const ppEv = { header: clip(pp), purpose: HEADER_PURPOSES["permissions-policy"] };
  if (pp) checks.push(check("permissions_policy", cat, "Permissions-Policy", 2, "pass", "Present.", ppEv));
  else {
    checks.push(check("permissions_policy", cat, "Permissions-Policy", 2, "fail", "Header missing.", ppEv));
    findings.push(makeFinding("permissions_missing", "No Permissions-Policy header.", ppEv));
  }

  // COOP (1)
  const coop = header(headers, "cross-origin-opener-policy");
  const coopEv = { header: clip(coop), purpose: HEADER_PURPOSES["cross-origin-opener-policy"] };
  if (coop && /same-origin/i.test(coop)) checks.push(check("coop", cat, "Cross-Origin-Opener-Policy", 1, "pass", `Set to ${coop}.`, coopEv));
  else {
    checks.push(check("coop", cat, "Cross-Origin-Opener-Policy", 1, "fail", coop ? `Set to ${coop}.` : "Header missing.", coopEv));
    findings.push(makeFinding("coop_missing", coop ? `COOP set to ${clip(coop, 60)}.` : "No Cross-Origin-Opener-Policy header.", coopEv));
  }

  return { checks, findings };
}
