import {
  DEFAULT_LIMITS,
  FetchFailedError,
  nodeTransport,
  resolvePublicAddress,
  safeFetch,
  SsrfBlockedError,
  systemResolver,
  type Resolver,
  type SafeFetchResult,
  type Transport,
} from "@/lib/security/safe-fetch";
import { validateTargetUrl } from "@/lib/security/url";
import { analyzeCookies } from "./modules/cookies";
import { analyzeDns, createSystemDnsDeps, type DnsDeps } from "./modules/dns";
import { analyzeHeaders } from "./modules/headers";
import { analyzeHttps } from "./modules/https";
import { detectTechnologies } from "./modules/technology";
import { analyzeTls, nodeTlsProbe, type TlsProbe, type TlsProbeResult } from "./modules/tls";
import { headerList, type Outcome } from "./modules/util";
import { analyzeWebsite } from "./modules/website";
import type { ScanResult } from "./types";

export interface ScannerDeps {
  resolver: Resolver;
  transport: Transport;
  tlsProbe: TlsProbe;
  dns: DnsDeps;
  now: () => Date;
}

export function defaultScannerDeps(): ScannerDeps {
  return {
    resolver: systemResolver,
    transport: nodeTransport,
    tlsProbe: nodeTlsProbe,
    dns: createSystemDnsDeps(),
    now: () => new Date(),
  };
}

export class ScanTargetError extends Error {
  constructor(public readonly publicMessage: string) {
    super(publicMessage);
    this.name = "ScanTargetError";
  }
}

/** Hard ceiling for the whole scan so it fits comfortably inside a serverless invocation. */
export const SCAN_BUDGET_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new FetchFailedError(`${label}: timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function outcome<T>(p: Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: e.reason, blocked: true };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Runs the bounded, passive assessment (Modules A–H).
 * Requests made: one TLS handshake, one HTTPS GET chain (≤5 validated redirects), one HTTP GET (no follow), DNS lookups.
 * Nothing is submitted, crawled, brute-forced or executed.
 */
export async function runScan(rawUrl: string, deps: ScannerDeps = defaultScannerDeps()): Promise<ScanResult> {
  const startedAt = deps.now();
  const target = validateTargetUrl(rawUrl);
  if (!target.ok) throw new ScanTargetError(target.message);
  const { hostname, registrableDomain } = target;

  // Pre-flight: refuse non-public destinations before any connection is attempted.
  let pinned: { ip: string; family: 4 | 6 };
  try {
    pinned = await withTimeout(resolvePublicAddress(hostname, deps.resolver), 5000, "dns");
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw new ScanTargetError("This website address resolves to a private or reserved network and cannot be assessed.");
    throw new ScanTargetError("The website's domain could not be resolved. Please check the address and try again.");
  }

  const fetchOpts = { resolver: deps.resolver, transport: deps.transport, timeoutMs: DEFAULT_LIMITS.timeoutMs };
  const [httpsRes, httpRes, tlsRes, dnsRes] = await Promise.all([
    outcome<SafeFetchResult>(withTimeout(safeFetch(`https://${hostname}/`, { ...fetchOpts, method: "GET" }), 20_000, "https")),
    outcome<SafeFetchResult>(withTimeout(safeFetch(`http://${hostname}/`, { ...fetchOpts, method: "GET", followRedirects: false, maxBytes: 64_000 }), 12_000, "http")),
    outcome<TlsProbeResult>(withTimeout(deps.tlsProbe(hostname, pinned.ip, pinned.family, 8000), 10_000, "tls")),
    withTimeout(analyzeDns(hostname, registrableDomain, deps.dns), 12_000, "dns").catch(() => null),
  ]);

  const limitations: string[] = [
    "Only the public homepage was requested; other pages, APIs and authenticated areas were not assessed.",
    "No forms were submitted, no accounts were created and no intrusive testing was performed.",
  ];

  const httpsUsable = httpsRes.ok && httpsRes.value.finalUrl.startsWith("https:");
  const https = analyzeHttps(httpsRes, httpRes);
  const tls = analyzeTls(tlsRes, deps.now());
  const headers = analyzeHeaders(httpsUsable && httpsRes.ok ? httpsRes.value.headers : null);
  const setCookies = httpsRes.ok ? httpsRes.value.hops.flatMap((h) => headerList(h.headers, "set-cookie")) : null;
  const cookies = analyzeCookies(httpsUsable ? setCookies : null);
  const website = analyzeWebsite(httpsRes);
  const tech = detectTechnologies(hostname, httpsRes.ok ? httpsRes.value.headers : null, website.html);

  let dns = dnsRes;
  if (!dns) {
    limitations.push("DNS checks timed out and were marked unavailable.");
    dns = { checks: [], findings: [] };
    for (const [k, t, p] of [["dns_address", "Address records (A/AAAA)", 3], ["spf", "SPF record", 4], ["dmarc", "DMARC policy", 5], ["dnssec", "DNSSEC", 3]] as const) {
      dns.checks.push({ key: k, category: "dns", title: t, status: "unavailable", maxPoints: p, earnedPoints: 0, summary: "DNS lookup timed out.", evidence: {} });
    }
  }
  if (httpsRes.ok && httpsRes.value.truncated) limitations.push("The homepage was larger than the inspection limit; only the first part was analysed.");
  if (!httpsRes.ok) limitations.push("The HTTPS homepage could not be retrieved, so header, cookie and content checks were marked unavailable.");

  const completedAt = deps.now();
  return {
    targetUrl: target.url.toString(),
    hostname,
    finalUrl: httpsRes.ok ? httpsRes.value.finalUrl : null,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    checks: [...https.checks, ...tls.checks, ...headers.checks, ...cookies.checks, ...dns.checks, ...website.checks, tech.check],
    findings: [...https.findings, ...tls.findings, ...headers.findings, ...cookies.findings, ...dns.findings, ...website.findings],
    technologies: tech.observations,
    limitations,
  };
}
