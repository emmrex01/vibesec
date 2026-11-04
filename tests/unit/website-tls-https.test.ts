import { describe, expect, it } from "vitest";
import type { SafeFetchResult } from "@/lib/security/safe-fetch";
import { analyzeHttps } from "@/lib/scanner/modules/https";
import { analyzeTls } from "@/lib/scanner/modules/tls";
import { detectTechnologies } from "@/lib/scanner/modules/technology";
import { analyzeWebsite, findMixedContent } from "@/lib/scanner/modules/website";
import { GOOD_CERT } from "../helpers/mock-net";

const res = (over: Partial<SafeFetchResult> = {}): SafeFetchResult => ({
  finalUrl: "https://example.com/",
  status: 200,
  headers: { "content-type": "text/html" },
  body: Buffer.from("<!doctype html><html></html>"),
  truncated: false,
  hops: [{ url: "https://example.com/", status: 200, ip: "93.184.215.14", headers: {} }],
  ...over,
});

describe("Module A — HTTPS", () => {
  it("passes HTTPS + permanent redirect", () => {
    const r = analyzeHttps({ ok: true, value: res() }, { ok: true, value: res({ finalUrl: "http://example.com/", status: 301, headers: { location: "https://example.com/" } }) });
    expect(r.checks.map((c) => c.status)).toEqual(["pass", "pass"]);
  });
  it("flags HTTP served without redirect and refused HTTPS", () => {
    const r = analyzeHttps({ ok: false, error: "ECONNREFUSED" }, { ok: true, value: res({ finalUrl: "http://example.com/", status: 200 }) });
    expect(r.findings.map((f) => f.key)).toEqual(["https_unavailable", "http_no_redirect"]);
  });
  it("does not penalise timeouts and closed port 80", () => {
    const r = analyzeHttps({ ok: false, error: "timeout" }, { ok: false, error: "ECONNREFUSED" });
    expect(r.checks.map((c) => c.status)).toEqual(["unavailable", "not_applicable"]);
    expect(r.findings).toHaveLength(0);
  });
  it("detects HTTPS→HTTP downgrade", () => {
    const r = analyzeHttps({ ok: true, value: res({ finalUrl: "http://example.com/" }) }, { ok: false, error: "ECONNREFUSED" });
    expect(r.findings[0].key).toBe("https_downgrade");
  });
});

describe("Module D — TLS", () => {
  const now = new Date("2026-11-04T00:00:00Z");
  it("passes a trusted, matching, long-lived certificate", () => {
    const r = analyzeTls({ ok: true, value: GOOD_CERT }, now);
    expect(r.checks.every((c) => c.status === "pass")).toBe(true);
  });
  it("reports expired, untrusted and mismatched certificates as High", () => {
    const expired = analyzeTls({ ok: true, value: { ...GOOD_CERT, authorized: false, authorizationError: "CERT_HAS_EXPIRED", validTo: "Oct  1 00:00:00 2026 GMT" } }, now);
    expect(expired.findings[0]).toMatchObject({ key: "cert_expired", severity: "high" });
    const selfSigned = analyzeTls({ ok: true, value: { ...GOOD_CERT, authorized: false, authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT" } }, now);
    expect(selfSigned.findings[0].key).toBe("cert_untrusted");
    const mismatch = analyzeTls({ ok: true, value: { ...GOOD_CERT, authorized: false, authorizationError: "ERR_TLS_CERT_ALTNAME_INVALID", hostnameMatch: false } }, now);
    expect(mismatch.checks.find((c) => c.key === "cert_trusted")!.status).toBe("pass");
    expect(mismatch.findings[0].key).toBe("cert_hostname_mismatch");
  });
  it("warns when expiry is near", () => {
    const r = analyzeTls({ ok: true, value: { ...GOOD_CERT, validTo: "Nov 10 00:00:00 2026 GMT" } }, now);
    expect(r.findings[0]).toMatchObject({ key: "cert_expiring_soon", severity: "medium" });
  });
  it("marks checks unavailable when the handshake fails", () => {
    const r = analyzeTls({ ok: false, error: "timeout" }, now);
    expect(r.checks.every((c) => c.status === "unavailable")).toBe(true);
  });
});

describe("Module F — website configuration", () => {
  it("finds active and passive mixed content but ignores plain links", () => {
    const html = `<script src="http://cdn.x.com/a.js"></script><img src="http://img.x.com/a.png"><a href="http://other.com">link</a><link rel="stylesheet" href="http://x.com/s.css"><link rel="canonical" href="http://x.com/">`;
    const m = findMixedContent(html);
    expect(m.active.sort()).toEqual(["http://cdn.x.com/a.js", "http://x.com/s.css"]);
    expect(m.passive).toEqual(["http://img.x.com/a.png"]);
  });
  it("flags version disclosure and X-Powered-By", () => {
    const r = analyzeWebsite({ ok: true, value: res({ headers: { "content-type": "text/html", server: "Apache/2.4.41 (Ubuntu)", "x-powered-by": "PHP/8.1" } }) });
    expect(r.findings.map((f) => f.key)).toEqual(expect.arrayContaining(["server_version_disclosure", "powered_by_disclosure"]));
  });
  it("treats 5xx as an availability observation, not a vulnerability", () => {
    const r = analyzeWebsite({ ok: true, value: res({ status: 503 }) });
    expect(r.findings.find((f) => f.key === "page_unexpected_status")?.severity).toBe("informational");
  });
  it("marks all checks unavailable when the site cannot be reached", () => {
    const r = analyzeWebsite({ ok: false, error: "timeout" });
    expect(r.checks.every((c) => c.status === "unavailable")).toBe(true);
  });
});

describe("Module G — technology", () => {
  it("detects indicators from headers and HTML without claiming development history", () => {
    const t = detectTechnologies("my-app.lovable.app", { "x-vercel-id": "abc", "cf-ray": "x" }, `<script id="__NEXT_DATA__"></script><script>const u="https://abcdefghijabcdefghij.supabase.co"</script>`);
    const names = t.observations.map((o) => o.name);
    expect(names).toEqual(expect.arrayContaining(["Vercel", "Cloudflare", "Next.js", "Supabase (public client reference)", "Lovable (indicator)"]));
    expect(t.observations.find((o) => o.name.startsWith("Lovable"))?.confidence).toBe("low");
    expect(t.check.summary).toMatch(/not confirmed development history/);
    expect(t.check.maxPoints).toBe(0);
  });
});
