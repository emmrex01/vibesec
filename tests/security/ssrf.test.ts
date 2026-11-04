import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runScan, ScanTargetError } from "@/lib/scanner";
import { nodeTransport, safeFetch, SsrfBlockedError } from "@/lib/security/safe-fetch";
import { mockResolver, mockTls, mockTransport, scannerDeps } from "../helpers/mock-net";

const PUBLIC = "93.184.215.14";

describe("SSRF: URL-level attempts", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://100.100.100.200/latest/meta-data/",
    "http://[fd00:ec2::254]/",
    "http://example.com:6379/",
    "http://example.com:2375/",
    "http://user:pass@example.com/",
    "gopher://example.com/",
    "file:///etc/passwd",
    "dict://example.com:11211/",
  ])("blocks %s without making a request", async (url) => {
    const transport = mockTransport({});
    await expect(safeFetch(url, { resolver: mockResolver({ "example.com": [PUBLIC] }), transport })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(transport.requests).toHaveLength(0);
  });
});

describe("SSRF: DNS-level attempts", () => {
  it.each([["127.0.0.1"], ["10.0.0.8"], ["192.168.0.10"], ["169.254.169.254"], ["::1"], ["fd12::1"], ["::ffff:10.0.0.1"], ["0.0.0.0"]])(
    "blocks public-looking hostnames that resolve to %s",
    async (ip) => {
      const transport = mockTransport({ "https://sneaky.example.com/": { status: 200 } });
      await expect(safeFetch("https://sneaky.example.com/", { resolver: mockResolver({ "sneaky.example.com": [ip] }), transport })).rejects.toBeInstanceOf(SsrfBlockedError);
      expect(transport.requests).toHaveLength(0);
    },
  );

  it("blocks when any one of several A records is private", async () => {
    const transport = mockTransport({ "https://multi.example.com/": { status: 200 } });
    await expect(safeFetch("https://multi.example.com/", { resolver: mockResolver({ "multi.example.com": [PUBLIC, "127.0.0.1"] }), transport })).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

describe("SSRF: redirects", () => {
  it.each([
    "http://127.0.0.1/admin",
    "http://localhost:8080/",
    "http://169.254.169.254/latest/meta-data/iam/",
    "http://[::1]/",
    "file:///etc/passwd",
  ])("rejects a redirect to %s", async (location) => {
    const transport = mockTransport({ "https://example.com/": { status: 302, headers: { location } } });
    await expect(safeFetch("https://example.com/", { resolver: mockResolver({ "example.com": [PUBLIC] }), transport })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(transport.requests).toHaveLength(1);
  });

  it("re-resolves and re-validates DNS on every redirect hop", async () => {
    const resolver = mockResolver({ "example.com": [PUBLIC], "redirect-target.example.org": ["10.0.0.1"] });
    const transport = mockTransport({ "https://example.com/": { status: 301, headers: { location: "https://redirect-target.example.org/" } } });
    await expect(safeFetch("https://example.com/", { resolver, transport })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(resolver.calls).toEqual(["example.com", "redirect-target.example.org"]);
    expect(transport.requests).toHaveLength(1);
  });
});

describe("SSRF: DNS rebinding", () => {
  it("pins the connection to the validated IP so a rebinding second lookup is never used", async () => {
    let n = 0;
    // First answer is public, every later answer is loopback (classic rebinding).
    const resolver = mockResolver({ "rebind.example.com": () => (n++ === 0 ? [PUBLIC] : ["127.0.0.1"]) });
    const transport = mockTransport({ "https://rebind.example.com/": { status: 200 } });
    const res = await safeFetch("https://rebind.example.com/", { resolver, transport });
    expect(res.status).toBe(200);
    expect(transport.requests[0].ip).toBe(PUBLIC);
    expect(resolver.calls).toHaveLength(1);
  });

  it("the full scanner pins every connection (HTTP, HTTPS, TLS) to validated public IPs", async () => {
    let n = 0;
    const resolver = mockResolver({ "rebind.example.com": () => (n++ === 0 ? [PUBLIC] : ["127.0.0.1"]) });
    const transport = mockTransport({});
    const tls = mockTls();
    await runScan("https://rebind.example.com", scannerDeps({ resolver, transport, tls }));
    // Later resolutions returned loopback → those fetches were refused before any connection.
    expect(transport.requests.every((r) => r.ip === PUBLIC)).toBe(true);
    expect(tls.calls.every((c) => c.ip === PUBLIC)).toBe(true);
  });

  it("refuses scans of hostnames that resolve privately", async () => {
    await expect(runScan("https://intranet.example.com", scannerDeps({ resolver: mockResolver({ "intranet.example.com": ["192.168.1.1"] }) }))).rejects.toBeInstanceOf(ScanTargetError);
  });
});

describe("SSRF: real sockets (local server must never be reached)", () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;
  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.end("internal secret");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("does not connect when DNS points at loopback, even with the real Node transport", async () => {
    await expect(safeFetch("http://attacker.example.com/", { resolver: mockResolver({ "attacker.example.com": ["127.0.0.1"] }), transport: nodeTransport })).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch(`http://127.0.0.1:${port}/`, { transport: nodeTransport })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(hits).toBe(0);
  });
});
