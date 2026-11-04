import ipaddr from "ipaddr.js";
import { parse as parseDomain } from "tldts";

export const MAX_URL_LENGTH = 2048;
export const ALLOWED_PORTS = new Set(["", "80", "443"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".home.arpa",
  ".arpa",
  ".test",
  ".invalid",
  ".example",
];

export type UrlValidation =
  | {
      ok: true;
      /** Origin-only URL that will be assessed (homepage). */
      url: URL;
      hostname: string;
      registrableDomain: string;
    }
  | { ok: false; code: UrlErrorCode; message: string };

export type UrlErrorCode =
  | "empty"
  | "too_long"
  | "invalid"
  | "scheme"
  | "credentials"
  | "port"
  | "ip_literal"
  | "blocked_host"
  | "invalid_domain";

function fail(code: UrlErrorCode, message: string): UrlValidation {
  return { ok: false, code, message };
}

/**
 * Normalises and validates a user-supplied website address.
 * Only http/https on default ports, real public domain names, no credentials,
 * no IP literals. The assessed target is always the site's homepage (origin).
 *
 * NOTE: this is only the first layer of SSRF defence. DNS resolution results
 * are validated separately (see safe-fetch.ts) before any connection is made.
 */
export function validateTargetUrl(raw: string): UrlValidation {
  const input = (raw ?? "").trim();
  if (!input) return fail("empty", "Please enter a website address.");
  if (input.length > MAX_URL_LENGTH) return fail("too_long", "That address is too long.");
  if (/[\s\u0000-\u001f\u007f\\]/.test(input)) return fail("invalid", "That address contains invalid characters.");

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return fail("invalid", "Please enter a valid website address, for example https://example.com.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return fail("scheme", "Only http:// and https:// website addresses are supported.");
  }
  if (parsed.username || parsed.password) {
    return fail("credentials", "Website addresses must not contain usernames or passwords.");
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return fail("port", "Only websites on the standard ports (80 and 443) can be assessed.");
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);

  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (ipaddr.isValid(bare) || /^[0-9.]+$/.test(bare) || /^0x/i.test(bare)) {
    return fail("ip_literal", "Please enter the website's domain name rather than an IP address.");
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return fail("blocked_host", "That address cannot be assessed.");
  }
  if (!hostname.includes(".")) {
    return fail("invalid_domain", "Please enter a full public domain name, for example example.com.");
  }
  if (hostname.length > 253 || hostname.split(".").some((l) => l.length === 0 || l.length > 63)) {
    return fail("invalid_domain", "That domain name is not valid.");
  }
  if (!/^[a-z0-9.-]+$/.test(hostname)) {
    return fail("invalid_domain", "That domain name is not valid.");
  }

  const info = parseDomain(hostname, { allowPrivateDomains: true });
  if (!info.domain || !info.publicSuffix || info.isIp) {
    return fail("invalid_domain", "That domain does not use a recognised public domain suffix.");
  }
  const icann = parseDomain(hostname);
  if (!icann.isIcann && !info.isPrivate) {
    return fail("invalid_domain", "That domain does not use a recognised public domain suffix.");
  }

  const normalised = new URL(`${parsed.protocol}//${hostname}/`);
  return {
    ok: true,
    url: normalised,
    hostname,
    registrableDomain: icann.domain ?? info.domain,
  };
}

/** Validates a redirect `Location` against the same rules. Relative locations are resolved first. */
export function validateRedirectTarget(location: string, base: URL): UrlValidation {
  let next: URL;
  try {
    next = new URL(location, base);
  } catch {
    return fail("invalid", "Invalid redirect location.");
  }
  const result = validateTargetUrl(next.toString());
  if (!result.ok) return result;
  // Keep the redirect's path for following, but host/port/scheme have been validated.
  const kept = new URL(next.toString());
  kept.hash = "";
  return { ...result, url: kept };
}
