import { describe, expect, it } from "vitest";
import { pinnedLookup, resolvePublicAddress, safeFetch, SsrfBlockedError } from "@/lib/security/safe-fetch";
import { mockResolver, mockTransport } from "../helpers/mock-net";

describe("resolvePublicAddress", () => {
  it("returns a pinned IPv4 when available", async () => {
    const r = await resolvePublicAddress("example.com", mockResolver({ "example.com": ["2606:4700::1", "93.184.215.14"] }));
    expect(r).toMatchObject({ ip: "93.184.215.14", family: 4 });
  });
  it("rejects when ANY resolved address is private", async () => {
    await expect(resolvePublicAddress("mixed.com", mockResolver({ "mixed.com": ["93.184.215.14", "10.0.0.5"] }))).rejects.toBeInstanceOf(SsrfBlockedError);
  });
  it("fails cleanly on DNS errors", async () => {
    await expect(resolvePublicAddress("nope.com", mockResolver({}))).rejects.toThrow(/DNS/);
  });
});

describe("pinnedLookup", () => {
  it("answers both single and all-address lookups with the pinned IP", () => {
    const lookup = pinnedLookup("93.184.215.14", 4);
    let single: unknown[] = [];
    let all: unknown[] = [];
    (lookup as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)("evil.com", {}, (...a) => (single = a));
    (lookup as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)("evil.com", { all: true }, (...a) => (all = a));
    expect(single).toEqual([null, "93.184.215.14", 4]);
    expect(all).toEqual([null, [{ address: "93.184.215.14", family: 4 }]]);
  });
});

describe("safeFetch", () => {
  it("connects to the validated IP and returns the response", async () => {
    const transport = mockTransport({ "https://example.com/": { status: 200, body: Buffer.from("<html></html>") } });
    const res = await safeFetch("https://example.com/", { resolver: mockResolver({ "example.com": ["93.184.215.14"] }), transport });
    expect(res.status).toBe(200);
    expect(transport.requests[0].ip).toBe("93.184.215.14");
    expect(transport.requests[0].method).toBe("GET");
  });

  it("follows validated redirects and records each hop", async () => {
    const transport = mockTransport({
      "https://example.com/": { status: 301, headers: { location: "https://www.example.com/" } },
      "https://www.example.com/": { status: 200 },
    });
    const res = await safeFetch("https://example.com/", { resolver: mockResolver({ "example.com": ["93.184.215.14"], "www.example.com": ["93.184.215.15"] }), transport });
    expect(res.finalUrl).toBe("https://www.example.com/");
    expect(res.hops.map((h) => h.status)).toEqual([301, 200]);
    expect(transport.requests[1].ip).toBe("93.184.215.15");
  });

  it("does not follow redirects when disabled", async () => {
    const transport = mockTransport({ "http://example.com/": { status: 301, headers: { location: "https://example.com/" } } });
    const res = await safeFetch("http://example.com/", { resolver: mockResolver({ "example.com": ["93.184.215.14"] }), transport, followRedirects: false });
    expect(res.status).toBe(301);
    expect(transport.requests).toHaveLength(1);
  });

  it("enforces the redirect limit", async () => {
    const routes: Record<string, { status: number; headers: Record<string, string> }> = {};
    for (let i = 0; i < 10; i++) routes[`https://example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
    routes["https://example.com/"] = { status: 302, headers: { location: "/0" } };
    await expect(safeFetch("https://example.com/", { resolver: mockResolver({ "example.com": ["93.184.215.14"] }), transport: mockTransport(routes) })).rejects.toThrow(/too many redirects/);
  });

  it("caps limits even if a caller asks for more", async () => {
    const transport = mockTransport({ "https://example.com/": { status: 200 } });
    await safeFetch("https://example.com/", { resolver: mockResolver({ "example.com": ["93.184.215.14"] }), transport, timeoutMs: 999_999, maxBytes: 999_999_999 });
    expect(transport.requests[0].timeoutMs).toBeLessThanOrEqual(15_000);
    expect(transport.requests[0].maxBytes).toBeLessThanOrEqual(5_000_000);
  });
});
