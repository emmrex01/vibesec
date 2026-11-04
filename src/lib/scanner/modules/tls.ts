import tls from "node:tls";
import type { PeerCertificate } from "node:tls";
import { pinnedLookup } from "@/lib/security/safe-fetch";
import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check, isConnectionRefused, type Outcome } from "./util";

export interface TlsProbeResult {
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  subjectCN: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  subjectAltNames: string[];
  hostnameMatch: boolean;
}

export type TlsProbe = (hostname: string, ip: string, family: 4 | 6, timeoutMs: number) => Promise<TlsProbeResult>;

function describeIssuer(cert: PeerCertificate): string | null {
  const i = cert.issuer as unknown as Record<string, string | undefined> | undefined;
  if (!i) return null;
  return [i.O, i.CN].filter(Boolean).join(" — ") || null;
}

/** Module D probe: single TLS handshake to the pinned IP with SNI; no application data is sent. */
export const nodeTlsProbe: TlsProbe = (hostname, ip, family, timeoutMs) =>
  new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      lookup: pinnedLookup(ip, family),
      rejectUnauthorized: false, // we want to *report* certificate problems, not just fail
      timeout: timeoutMs,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, timeoutMs);

    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const cert = socket.getPeerCertificate();
      const san = (cert.subjectaltname ?? "")
        .split(",")
        .map((s) => s.trim().replace(/^DNS:/, ""))
        .filter(Boolean)
        .slice(0, 25);
      const identityError = cert && Object.keys(cert).length ? tls.checkServerIdentity(hostname, cert) : new Error("no certificate");
      const authError = socket.authorizationError;
      resolve({
        authorized: socket.authorized,
        authorizationError: authError ? String((authError as NodeJS.ErrnoException).code ?? authError) : null,
        protocol: socket.getProtocol() ?? null,
        subjectCN: (cert.subject as unknown as Record<string, string> | undefined)?.CN ?? null,
        issuer: describeIssuer(cert),
        validFrom: cert.valid_from ?? null,
        validTo: cert.valid_to ?? null,
        subjectAltNames: san,
        hostnameMatch: !identityError,
      });
      socket.end();
    });
    socket.once("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(err.code ?? err.message));
    });
  });

const EXPIRED_CODES = ["CERT_HAS_EXPIRED"];

export function analyzeTls(
  probe: Outcome<TlsProbeResult>,
  now: Date = new Date(),
): { checks: CheckResult[]; findings: Finding[] } {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const titles = {
    cert_trusted: "Certificate trust",
    cert_hostname: "Certificate hostname match",
    cert_expiry: "Certificate expiry",
  } as const;

  if (!probe.ok) {
    const status = !probe.blocked && isConnectionRefused(probe.error) ? "not_applicable" : "unavailable";
    const summary = status === "not_applicable" ? "No TLS service on port 443." : "TLS handshake could not be completed.";
    for (const [key, title] of Object.entries(titles)) {
      checks.push(check(key, "https_tls", title, key === "cert_hostname" ? 4 : 5, status, summary, { error: probe.error }));
    }
    return { checks, findings };
  }

  const p = probe.value;
  const evidence = {
    protocol: p.protocol,
    subject: p.subjectCN,
    issuer: p.issuer,
    validFrom: p.validFrom,
    validTo: p.validTo,
    subjectAltNames: p.subjectAltNames,
  };

  // cert_trusted (5)
  const chainError = p.authorizationError && p.authorizationError !== "ERR_TLS_CERT_ALTNAME_INVALID" ? p.authorizationError : null;
  if (!chainError) {
    checks.push(check("cert_trusted", "https_tls", titles.cert_trusted, 5, "pass", `Trusted certificate issued by ${p.issuer ?? "a recognised authority"}.`, evidence));
  } else if (EXPIRED_CODES.includes(chainError)) {
    checks.push(check("cert_trusted", "https_tls", titles.cert_trusted, 5, "fail", "The certificate has expired.", { ...evidence, error: chainError }));
    findings.push(makeFinding("cert_expired", `Certificate valid until ${p.validTo}.`, { ...evidence, error: chainError }));
  } else {
    checks.push(check("cert_trusted", "https_tls", titles.cert_trusted, 5, "fail", "The certificate could not be verified.", { ...evidence, error: chainError }));
    findings.push(makeFinding("cert_untrusted", `Certificate verification failed (${chainError}).`, { ...evidence, error: chainError }));
  }

  // cert_hostname (4)
  if (p.hostnameMatch) {
    checks.push(check("cert_hostname", "https_tls", titles.cert_hostname, 4, "pass", "The certificate is valid for this hostname.", evidence));
  } else {
    checks.push(check("cert_hostname", "https_tls", titles.cert_hostname, 4, "fail", "The certificate does not cover this hostname.", evidence));
    findings.push(makeFinding("cert_hostname_mismatch", `Certificate names: ${p.subjectAltNames.slice(0, 5).join(", ") || p.subjectCN || "unknown"}.`, evidence));
  }

  // cert_expiry (5)
  const validTo = p.validTo ? new Date(p.validTo) : null;
  if (!validTo || Number.isNaN(validTo.getTime())) {
    checks.push(check("cert_expiry", "https_tls", titles.cert_expiry, 5, "unavailable", "Expiry date could not be read.", evidence));
  } else {
    const days = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000);
    const ev = { ...evidence, daysRemaining: days };
    if (days < 0) {
      checks.push(check("cert_expiry", "https_tls", titles.cert_expiry, 5, "fail", `Expired ${Math.abs(days)} day(s) ago.`, ev));
      if (!findings.some((f) => f.key === "cert_expired")) findings.push(makeFinding("cert_expired", `Certificate expired on ${p.validTo}.`, ev));
    } else if (days < 14) {
      checks.push(check("cert_expiry", "https_tls", titles.cert_expiry, 5, "warn", `Expires in ${days} day(s).`, ev, 1));
      findings.push(makeFinding("cert_expiring_soon", `Certificate expires in ${days} day(s) (${p.validTo}).`, ev));
    } else if (days < 30) {
      checks.push(check("cert_expiry", "https_tls", titles.cert_expiry, 5, "warn", `Expires in ${days} days.`, ev, 3));
      findings.push(makeFinding("cert_expiring_soon", `Certificate expires in ${days} days (${p.validTo}).`, ev, { severity: "low" }));
    } else {
      checks.push(check("cert_expiry", "https_tls", titles.cert_expiry, 5, "pass", `Valid for another ${days} days.`, ev));
    }
  }

  return { checks, findings };
}
