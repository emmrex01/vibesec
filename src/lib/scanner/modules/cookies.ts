import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check } from "./util";

export interface ParsedCookie {
  /** Cookie NAME only — values are discarded during parsing and never stored. */
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  domain: string | null;
  path: string | null;
}

const SESSION_LIKE = /(sess|sid|auth|token|jwt|login|csrf|xsrf|connect\.sid|phpsessid|jsessionid|asp\.net|remember|supabase|sb-)/i;

export function parseSetCookie(raw: string): ParsedCookie | null {
  const parts = raw.split(";");
  const first = parts.shift() ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim().slice(0, 64);
  // value = first.slice(eq + 1) is intentionally ignored
  const cookie: ParsedCookie = { name, secure: false, httpOnly: false, sameSite: null, domain: null, path: null };
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    const key = k.toLowerCase();
    const val = rest.join("=").trim();
    if (key === "secure") cookie.secure = true;
    else if (key === "httponly") cookie.httpOnly = true;
    else if (key === "samesite") cookie.sameSite = val.toLowerCase() || null;
    else if (key === "domain") cookie.domain = val.slice(0, 120) || null;
    else if (key === "path") cookie.path = val.slice(0, 120) || null;
  }
  return cookie;
}

/** Module C — cookie security attributes. Only attribute metadata is retained. */
export function analyzeCookies(setCookieHeaders: string[] | null): { checks: CheckResult[]; findings: Finding[]; cookies: ParsedCookie[] } {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const cat = "cookies" as const;

  if (setCookieHeaders === null) {
    for (const [k, t, p] of [["cookie_secure", "Secure attribute", 6], ["cookie_httponly", "HttpOnly attribute", 5], ["cookie_samesite", "SameSite attribute", 4]] as const) {
      checks.push(check(k, cat, t, p, "unavailable", "No HTTPS response available to inspect."));
    }
    return { checks, findings, cookies: [] };
  }

  const cookies = setCookieHeaders.map(parseSetCookie).filter((c): c is ParsedCookie => !!c).slice(0, 50);
  if (!cookies.length) {
    for (const [k, t, p] of [["cookie_secure", "Secure attribute", 6], ["cookie_httponly", "HttpOnly attribute", 5], ["cookie_samesite", "SameSite attribute", 4]] as const) {
      checks.push(check(k, cat, t, p, "not_applicable", "No cookies were set on the homepage response."));
    }
    return { checks, findings, cookies };
  }

  const summary = cookies.map((c) => ({ name: c.name, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, domain: c.domain }));

  const insecure = cookies.filter((c) => !c.secure).map((c) => c.name);
  if (!insecure.length) checks.push(check("cookie_secure", cat, "Secure attribute", 6, "pass", `All ${cookies.length} cookie(s) are marked Secure.`, { cookies: summary }));
  else {
    checks.push(check("cookie_secure", cat, "Secure attribute", 6, "fail", `${insecure.length} of ${cookies.length} cookie(s) lack Secure.`, { cookies: summary }, 6 * (1 - insecure.length / cookies.length)));
    findings.push(makeFinding("cookie_not_secure", `Cookies without Secure: ${insecure.join(", ")}.`, { cookieNames: insecure }));
  }

  const noHttpOnly = cookies.filter((c) => !c.httpOnly);
  const sessionNoHttpOnly = noHttpOnly.filter((c) => SESSION_LIKE.test(c.name)).map((c) => c.name);
  if (!noHttpOnly.length) checks.push(check("cookie_httponly", cat, "HttpOnly attribute", 5, "pass", "All cookies are HttpOnly.", { cookies: summary }));
  else if (!sessionNoHttpOnly.length) checks.push(check("cookie_httponly", cat, "HttpOnly attribute", 5, "warn", "Some non-session cookies are readable by scripts (often intentional).", { cookies: summary }, 4));
  else {
    checks.push(check("cookie_httponly", cat, "HttpOnly attribute", 5, "fail", `${sessionNoHttpOnly.length} session-like cookie(s) lack HttpOnly.`, { cookies: summary }));
    findings.push(makeFinding("cookie_not_httponly", `Session-like cookies without HttpOnly: ${sessionNoHttpOnly.join(", ")}.`, { cookieNames: sessionNoHttpOnly }));
  }

  const noneInsecure = cookies.filter((c) => c.sameSite === "none" && !c.secure).map((c) => c.name);
  const missingSameSite = cookies.filter((c) => !c.sameSite).map((c) => c.name);
  if (noneInsecure.length) {
    checks.push(check("cookie_samesite", cat, "SameSite attribute", 4, "fail", "SameSite=None used without Secure.", { cookies: summary }));
    findings.push(makeFinding("cookie_samesite_none_insecure", `Cookies with SameSite=None but no Secure: ${noneInsecure.join(", ")}.`, { cookieNames: noneInsecure }));
  } else if (missingSameSite.length) {
    checks.push(check("cookie_samesite", cat, "SameSite attribute", 4, "warn", `${missingSameSite.length} cookie(s) have no explicit SameSite.`, { cookies: summary }, 2));
    findings.push(makeFinding("cookie_samesite", `Cookies without SameSite: ${missingSameSite.join(", ")}.`, { cookieNames: missingSameSite }));
  } else {
    checks.push(check("cookie_samesite", cat, "SameSite attribute", 4, "pass", "All cookies set SameSite.", { cookies: summary }));
  }

  return { checks, findings, cookies };
}
