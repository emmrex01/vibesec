import { describe, expect, it } from "vitest";
import { analyzeCookies, parseSetCookie } from "@/lib/scanner/modules/cookies";

describe("parseSetCookie", () => {
  it("parses attributes and NEVER keeps the cookie value", () => {
    const c = parseSetCookie("session_id=SUPERSECRETVALUE123; Path=/; Secure; HttpOnly; SameSite=Lax; Domain=.example.com")!;
    expect(c).toEqual({ name: "session_id", secure: true, httpOnly: true, sameSite: "lax", domain: ".example.com", path: "/" });
    expect(JSON.stringify(c)).not.toContain("SUPERSECRETVALUE123");
  });
  it("ignores malformed cookies", () => {
    expect(parseSetCookie("=novalue")).toBeNull();
    expect(parseSetCookie("garbage")).toBeNull();
  });
});

describe("analyzeCookies", () => {
  it("is not applicable when no cookies are set", () => {
    const r = analyzeCookies([]);
    expect(r.checks.every((c) => c.status === "not_applicable")).toBe(true);
  });

  it("passes secure cookies", () => {
    const r = analyzeCookies(["sid=a; Secure; HttpOnly; SameSite=Strict"]);
    expect(r.checks.every((c) => c.status === "pass")).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("flags insecure session cookies and keeps values out of evidence", () => {
    const r = analyzeCookies(["PHPSESSID=VALUE_SHOULD_NOT_LEAK; Path=/", "theme=dark; Secure; SameSite=Lax"]);
    const keys = r.findings.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["cookie_not_secure", "cookie_not_httponly", "cookie_samesite"]));
    expect(JSON.stringify(r)).not.toContain("VALUE_SHOULD_NOT_LEAK");
    const secure = r.checks.find((c) => c.key === "cookie_secure")!;
    expect(secure.earnedPoints).toBe(3); // 1 of 2 cookies secure
  });

  it("treats non-session cookies without HttpOnly as a warning only", () => {
    const r = analyzeCookies(["theme=dark; Secure; SameSite=Lax"]);
    expect(r.checks.find((c) => c.key === "cookie_httponly")!.status).toBe("warn");
    expect(r.findings).toHaveLength(0);
  });

  it("flags SameSite=None without Secure", () => {
    const r = analyzeCookies(["track=1; SameSite=None"]);
    expect(r.findings.map((f) => f.key)).toContain("cookie_samesite_none_insecure");
  });
});
