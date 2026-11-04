import { describe, expect, it } from "vitest";
import { validateRedirectTarget, validateTargetUrl } from "@/lib/security/url";

describe("validateTargetUrl", () => {
  it("normalises valid public URLs to the homepage origin", () => {
    const r = validateTargetUrl("Example.com/pricing?x=1#top");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url.toString()).toBe("https://example.com/");
      expect(r.hostname).toBe("example.com");
      expect(r.registrableDomain).toBe("example.com");
    }
  });

  it("keeps http scheme when given and computes registrable domain for subdomains", () => {
    const r = validateTargetUrl("http://app.startup.co.uk");
    expect(r.ok && r.url.toString()).toBe("http://app.startup.co.uk/");
    expect(r.ok && r.registrableDomain).toBe("startup.co.uk");
  });

  it("accepts platform subdomains on private suffixes", () => {
    expect(validateTargetUrl("https://my-app.lovable.app").ok).toBe(true);
    expect(validateTargetUrl("https://thing.vercel.app").ok).toBe(true);
  });

  it("converts IDN to punycode", () => {
    const r = validateTargetUrl("https://bücher.de");
    expect(r.ok && r.hostname).toBe("xn--bcher-kva.de");
  });

  it.each([
    ["", "empty"],
    ["ftp://example.com", "scheme"],
    ["file:///etc/passwd", "scheme"],
    ["javascript:alert(1)", "invalid"],
    ["gopher://example.com", "scheme"],
    ["https://user:pass@example.com", "credentials"],
    ["https://example.com:8080", "port"],
    ["https://example.com:22", "port"],
    ["https://127.0.0.1", "ip_literal"],
    ["https://[::1]", "ip_literal"],
    ["https://2130706433", "ip_literal"],
    ["https://0x7f000001", "ip_literal"],
    ["https://localhost", "blocked_host"],
    ["https://foo.localhost", "blocked_host"],
    ["https://metadata.google.internal", "blocked_host"],
    ["https://printer.local", "blocked_host"],
    ["https://intranet", "invalid_domain"],
    ["https://example.notarealtld", "invalid_domain"],
    ["https://exa mple.com", "invalid"],
    [`https://${"a".repeat(2050)}.com`, "too_long"],
  ])("rejects %s (%s)", (input, code) => {
    const r = validateTargetUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(code);
  });
});

describe("validateRedirectTarget", () => {
  const base = new URL("https://example.com/");
  it("resolves relative redirects and keeps the path", () => {
    const r = validateRedirectTarget("/home?a=1", base);
    expect(r.ok && r.url.toString()).toBe("https://example.com/home?a=1");
  });
  it("rejects redirects to internal hosts, IPs and odd schemes", () => {
    expect(validateRedirectTarget("http://localhost/admin", base).ok).toBe(false);
    expect(validateRedirectTarget("http://169.254.169.254/latest/meta-data/", base).ok).toBe(false);
    expect(validateRedirectTarget("file:///etc/passwd", base).ok).toBe(false);
    expect(validateRedirectTarget("https://example.com:6379/", base).ok).toBe(false);
  });
});
