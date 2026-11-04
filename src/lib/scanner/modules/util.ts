import type { CheckCategory, CheckResult, CheckStatus } from "../types";

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string; blocked?: boolean };

export function check(
  key: string,
  category: CheckCategory,
  title: string,
  maxPoints: number,
  status: CheckStatus,
  summary: string,
  evidence: Record<string, unknown> = {},
  earned?: number,
): CheckResult {
  const scored = status === "pass" || status === "warn" || status === "fail";
  const earnedPoints = !scored
    ? 0
    : earned !== undefined
      ? Math.max(0, Math.min(maxPoints, earned))
      : status === "pass"
        ? maxPoints
        : status === "warn"
          ? maxPoints / 2
          : 0;
  return { key, category, title, status, maxPoints: status === "info" ? 0 : maxPoints, earnedPoints, summary, evidence };
}

export function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v.join(", ") : v;
}

export function headerList(headers: Record<string, string | string[] | undefined>, name: string): string[] {
  const v = headers[name.toLowerCase()];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Trims long evidence strings so reports never carry large or unexpected payloads. */
export function clip(value: string | undefined, max = 300): string | undefined {
  if (value === undefined) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const UNREACHABLE_CODES = ["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"];
export function isConnectionRefused(error: string) {
  return UNREACHABLE_CODES.some((c) => error.includes(c));
}

const TLS_ERROR_HINTS = ["CERT", "SELF_SIGNED", "UNABLE_TO_VERIFY", "ERR_TLS", "SSL", "EPROTO"];
export function isTlsError(error: string) {
  return TLS_ERROR_HINTS.some((c) => error.toUpperCase().includes(c));
}
