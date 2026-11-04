import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import { classifyIp } from "./ip";
import { validateRedirectTarget, validateTargetUrl } from "./url";

export const SCANNER_USER_AGENT =
  "VibeSecHealthCheck/1.0 (+passive security configuration check; authorised by site owner)";

export const DEFAULT_LIMITS = {
  timeoutMs: 8000,
  maxBytes: 1_500_000,
  maxRedirects: 5,
};

export class SsrfBlockedError extends Error {
  constructor(public readonly reason: string) {
    super(`Destination blocked: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

export class FetchFailedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "FetchFailedError";
  }
}

export type Resolver = (hostname: string) => Promise<string[]>;

export interface TransportRequest {
  url: URL;
  /** Pre-validated IP the connection MUST be made to (DNS pinning). */
  ip: string;
  family: 4 | 6;
  method: "GET" | "HEAD";
  timeoutMs: number;
  maxBytes: number;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  truncated: boolean;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export interface Hop {
  url: string;
  status: number;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  truncated: boolean;
  hops: Hop[];
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  followRedirects?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  resolver?: Resolver;
  transport?: Transport;
}

/** Default resolver: every A and AAAA address for the host. */
export const systemResolver: Resolver = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

/**
 * Resolves a hostname and requires EVERY returned address to be public.
 * Returns the address the connection will be pinned to.
 */
export async function resolvePublicAddress(
  hostname: string,
  resolver: Resolver = systemResolver,
): Promise<{ ip: string; family: 4 | 6; all: string[] }> {
  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new FetchFailedError("DNS resolution failed");
  }
  if (!addresses.length) throw new FetchFailedError("DNS resolution returned no addresses");

  let chosen: { ip: string; family: 4 | 6 } | null = null;
  for (const a of addresses) {
    const check = classifyIp(a);
    if (!check.ok) throw new SsrfBlockedError(`${hostname} resolves to a non-public address (${check.reason})`);
    if (!chosen || (chosen.family === 6 && check.family === 4)) chosen = { ip: check.address, family: check.family };
  }
  return { ...chosen!, all: addresses };
}

/** Lookup function that ignores DNS entirely and returns the pinned, pre-validated IP. */
export function pinnedLookup(ip: string, family: 4 | 6): LookupFunction {
  return ((_hostname: string, options: dns.LookupOptions | number | undefined, callback: unknown) => {
    const cb = (typeof options === "function" ? options : callback) as (...args: unknown[]) => void;
    const opts = typeof options === "object" && options ? options : {};
    if ((opts as dns.LookupAllOptions).all) cb(null, [{ address: ip, family }]);
    else cb(null, ip, family);
  }) as unknown as LookupFunction;
}

/** Node http/https transport that connects only to the pinned IP. No proxies, no cookies, fixed headers. */
export const nodeTransport: Transport = (req) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const isHttps = req.url.protocol === "https:";
    const mod = isHttps ? https : http;
    let settled = false;
    const finish = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn();
      }
    };

    const request = mod.request(
      {
        protocol: req.url.protocol,
        hostname: req.url.hostname,
        port: Number(req.url.port || (isHttps ? 443 : 80)),
        path: `${req.url.pathname}${req.url.search}`,
        method: req.method,
        agent: false,
        lookup: pinnedLookup(req.ip, req.family),
        family: req.family,
        servername: isHttps ? req.url.hostname : undefined,
        rejectUnauthorized: true,
        headers: {
          "User-Agent": SCANNER_USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en",
          Connection: "close",
        },
      },
      (res) => {
        // Defence in depth: confirm the socket really connected to the pinned IP.
        const remote = res.socket?.remoteAddress;
        if (remote && remote.replace(/^::ffff:/, "") !== req.ip.replace(/^::ffff:/, "")) {
          request.destroy();
          return finish(() => reject(new SsrfBlockedError("connected address did not match validated address")));
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (req.method === "GET") {
          if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
          else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
          else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
        }
        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > req.maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, req.maxBytes - (size - chunk.length))));
            res.destroy();
            finish(() =>
              resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated }),
            );
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          finish(() =>
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated }),
          ),
        );
        stream.on("error", (err: NodeJS.ErrnoException) =>
          finish(() => reject(new FetchFailedError(err.code ?? "response stream error"))),
        );
      },
    );

    const timer = setTimeout(() => {
      request.destroy();
      finish(() => reject(new FetchFailedError("timeout")));
    }, req.timeoutMs);

    request.on("error", (err: NodeJS.ErrnoException) =>
      finish(() => reject(new FetchFailedError(err.code ?? err.message ?? "request failed"))),
    );
    request.end();
  });

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function headerValue(h: string | string[] | undefined): string | undefined {
  return Array.isArray(h) ? h[0] : h;
}

/**
 * SSRF-safe fetch:
 *  - URL validated (scheme, port, host)
 *  - DNS resolved first; every address must be public
 *  - connection pinned to the validated IP (no second DNS lookup → DNS-rebinding safe)
 *  - redirects followed manually, each hop fully re-validated, small fixed limit
 *  - GET/HEAD only, fixed headers, timeouts and response size limits
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const method = options.method ?? "GET";
  const maxRedirects = Math.min(options.maxRedirects ?? DEFAULT_LIMITS.maxRedirects, DEFAULT_LIMITS.maxRedirects);
  const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_LIMITS.timeoutMs, 15000);
  const maxBytes = Math.min(options.maxBytes ?? DEFAULT_LIMITS.maxBytes, 5_000_000);
  const resolver = options.resolver ?? systemResolver;
  const transport = options.transport ?? nodeTransport;
  const follow = options.followRedirects ?? true;

  const initial = validateTargetUrl(rawUrl);
  if (!initial.ok) throw new SsrfBlockedError(initial.message);
  // validateTargetUrl normalises to origin; keep the caller's path only if explicitly given.
  let current = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  current = new URL(`${initial.url.protocol}//${initial.hostname}${current.pathname}${current.search}`);

  const hops: Hop[] = [];
  for (let i = 0; i <= maxRedirects; i++) {
    const { ip, family } = await resolvePublicAddress(current.hostname, resolver);
    const res = await transport({ url: current, ip, family, method, timeoutMs, maxBytes });
    hops.push({ url: current.toString(), status: res.status, ip, headers: res.headers });

    const location = headerValue(res.headers["location"]);
    if (follow && isRedirect(res.status) && location) {
      if (i === maxRedirects) throw new FetchFailedError("too many redirects");
      const next = validateRedirectTarget(location, current);
      if (!next.ok) throw new SsrfBlockedError(`redirect rejected: ${next.message}`);
      current = next.url;
      continue;
    }
    return {
      finalUrl: current.toString(),
      status: res.status,
      headers: res.headers,
      body: res.body,
      truncated: res.truncated,
      hops,
    };
  }
  throw new FetchFailedError("too many redirects");
}
