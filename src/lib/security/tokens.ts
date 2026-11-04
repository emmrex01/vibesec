import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit, URL-safe report access token. Only its SHA-256 hash is stored. */
export function generateReportToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function generateReportNumber(now = new Date()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let suffix = "";
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `VSH-${now.getUTCFullYear()}-${suffix}`;
}

/** Salted hash so IP addresses are never stored in clear text. */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Extracts a bearer token from an Authorization header. */
export function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+([A-Za-z0-9_-]+)$/.exec(headerValue.trim());
  return m ? m[1] : null;
}
