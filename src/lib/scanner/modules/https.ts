import type { SafeFetchResult } from "@/lib/security/safe-fetch";
import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check, header, isConnectionRefused, isTlsError, type Outcome } from "./util";

/**
 * Module A — HTTPS configuration.
 * @param httpsResult fetch of https://host/ following validated redirects
 * @param httpResult  fetch of http://host/ WITHOUT following redirects
 */
export function analyzeHttps(
  httpsResult: Outcome<SafeFetchResult>,
  httpResult: Outcome<SafeFetchResult>,
): { checks: CheckResult[]; findings: Finding[] } {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];

  // --- https_supported (6) -------------------------------------------------
  if (httpsResult.ok) {
    const final = new URL(httpsResult.value.finalUrl);
    if (final.protocol === "http:") {
      checks.push(
        check("https_supported", "https_tls", "HTTPS support", 6, "warn", "HTTPS responds, but redirects visitors to HTTP.", {
          finalUrl: httpsResult.value.finalUrl,
        }, 2),
      );
      findings.push(
        makeFinding("https_downgrade", `https:// homepage ended at ${httpsResult.value.finalUrl}.`, {
          redirectChain: httpsResult.value.hops.map((h) => `${h.status} ${h.url}`),
        }),
      );
    } else {
      checks.push(
        check("https_supported", "https_tls", "HTTPS support", 6, "pass", "The homepage is served over HTTPS.", {
          finalUrl: httpsResult.value.finalUrl,
          status: httpsResult.value.status,
        }),
      );
    }
  } else if (httpsResult.blocked) {
    checks.push(check("https_supported", "https_tls", "HTTPS support", 6, "unavailable", "Check not performed (destination not permitted).", { reason: httpsResult.error }));
  } else if (isTlsError(httpsResult.error)) {
    checks.push(
      check("https_supported", "https_tls", "HTTPS support", 6, "warn", "HTTPS responds but the certificate could not be verified (see certificate checks).", { error: httpsResult.error }, 3),
    );
  } else if (isConnectionRefused(httpsResult.error)) {
    checks.push(check("https_supported", "https_tls", "HTTPS support", 6, "fail", "No HTTPS service responded on port 443.", { error: httpsResult.error }));
    findings.push(makeFinding("https_unavailable", "The connection to port 443 was refused.", { error: httpsResult.error }));
  } else {
    checks.push(check("https_supported", "https_tls", "HTTPS support", 6, "unavailable", "HTTPS could not be checked (timeout or network error).", { error: httpsResult.error }));
  }

  // --- http_to_https (5) ---------------------------------------------------
  if (httpResult.ok) {
    const res = httpResult.value;
    const location = header(res.headers, "location");
    if ([301, 302, 303, 307, 308].includes(res.status) && location) {
      let target: URL | null = null;
      try {
        target = new URL(location, res.finalUrl);
      } catch {
        target = null;
      }
      if (target?.protocol === "https:") {
        const permanent = res.status === 301 || res.status === 308;
        checks.push(
          check("http_to_https", "https_tls", "HTTP to HTTPS redirect", 5, "pass",
            `HTTP redirects to HTTPS (${res.status}${permanent ? ", permanent" : ", temporary"}).`,
            { status: res.status, location: target.toString() }),
        );
      } else {
        checks.push(check("http_to_https", "https_tls", "HTTP to HTTPS redirect", 5, "fail", "HTTP redirects, but not to HTTPS.", { status: res.status, location }));
        findings.push(makeFinding("http_redirect_insecure", `http:// redirected to ${location}.`, { status: res.status, location }));
      }
    } else {
      checks.push(check("http_to_https", "https_tls", "HTTP to HTTPS redirect", 5, "fail", `HTTP homepage served directly (status ${res.status}).`, { status: res.status }));
      findings.push(makeFinding("http_no_redirect", `http:// homepage returned status ${res.status} without redirecting to HTTPS.`, { status: res.status }));
    }
  } else if (!httpResult.blocked && isConnectionRefused(httpResult.error)) {
    checks.push(check("http_to_https", "https_tls", "HTTP to HTTPS redirect", 5, "not_applicable", "Plain HTTP is not served (port 80 closed).", { error: httpResult.error }));
  } else {
    checks.push(check("http_to_https", "https_tls", "HTTP to HTTPS redirect", 5, "unavailable", "HTTP behaviour could not be checked.", { error: httpResult.error }));
  }

  return { checks, findings };
}
