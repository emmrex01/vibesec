import type { Resolver, Transport, TransportRequest, TransportResponse } from "@/lib/security/safe-fetch";
import type { DnsDeps } from "@/lib/scanner/modules/dns";
import type { TlsProbe, TlsProbeResult } from "@/lib/scanner/modules/tls";
import type { ScannerDeps } from "@/lib/scanner";

export function mockResolver(map: Record<string, string[] | (() => string[])>): Resolver & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (host: string) => {
    calls.push(host);
    const v = map[host];
    if (!v) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return typeof v === "function" ? v() : v;
  }) as Resolver & { calls: string[] };
  fn.calls = calls;
  return fn;
}

export type MockRoute = Partial<TransportResponse> & { error?: string };

/** Transport keyed by full URL. Records every request (including the pinned IP). */
export function mockTransport(routes: Record<string, MockRoute>): Transport & { requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const fn = (async (req: TransportRequest) => {
    requests.push(req);
    const r = routes[req.url.toString()];
    if (!r) throw new Error("ECONNREFUSED");
    if (r.error) throw new Error(r.error);
    return { status: r.status ?? 200, headers: r.headers ?? {}, body: r.body ?? Buffer.from(""), truncated: r.truncated ?? false };
  }) as Transport & { requests: TransportRequest[] };
  fn.requests = requests;
  return fn;
}

export const GOOD_CERT: TlsProbeResult = {
  authorized: true,
  authorizationError: null,
  protocol: "TLSv1.3",
  subjectCN: "example.com",
  issuer: "Let's Encrypt — R11",
  validFrom: "Jan  1 00:00:00 2026 GMT",
  validTo: "Mar  1 00:00:00 2027 GMT",
  subjectAltNames: ["example.com", "www.example.com"],
  hostnameMatch: true,
};

export function mockTls(result: TlsProbeResult | Error = GOOD_CERT): TlsProbe & { calls: { host: string; ip: string }[] } {
  const calls: { host: string; ip: string }[] = [];
  const fn = (async (host: string, ip: string) => {
    calls.push({ host, ip });
    if (result instanceof Error) throw result;
    return result;
  }) as unknown as TlsProbe & { calls: { host: string; ip: string }[] };
  fn.calls = calls;
  return fn;
}

export function mockDns(over: Partial<{ a: string[]; aaaa: string[]; mx: { exchange: string; priority: number }[]; txt: Record<string, string[][]>; ds: boolean | Error }> = {}): DnsDeps {
  const noData = () => Promise.reject(Object.assign(new Error("ENODATA"), { code: "ENODATA" }));
  return {
    resolve4: async () => over.a ?? ["93.184.215.14"],
    resolve6: async () => over.aaaa ?? [],
    resolveMx: async () => over.mx ?? [{ exchange: "mx.example.com", priority: 10 }],
    resolveTxt: async (h) => (over.txt?.[h] ? over.txt[h] : noData()),
    hasDsRecord: async () => {
      if (over.ds instanceof Error) throw over.ds;
      return over.ds ?? false;
    },
  };
}

export const SECURE_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
  "cross-origin-opener-policy": "same-origin",
  "content-type": "text/html; charset=utf-8",
};

export function scannerDeps(opts: {
  resolver?: Resolver;
  transport?: Transport;
  tls?: TlsProbe;
  dns?: DnsDeps;
} = {}): ScannerDeps {
  return {
    resolver: opts.resolver ?? mockResolver({ "example.com": ["93.184.215.14"] }),
    transport: opts.transport ?? mockTransport({}),
    tlsProbe: opts.tls ?? mockTls(),
    dns: opts.dns ?? mockDns(),
    now: () => new Date("2026-11-04T12:00:00Z"),
  };
}
