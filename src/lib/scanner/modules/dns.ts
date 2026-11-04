import { Resolver as DnsResolver } from "node:dns/promises";
import { makeFinding } from "../catalog";
import type { CheckResult, Finding } from "../types";
import { check } from "./util";

export interface DnsDeps {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveMx(host: string): Promise<{ exchange: string; priority: number }[]>;
  resolveTxt(host: string): Promise<string[][]>;
  /** true = DS record present, false = none, throws = unknown */
  hasDsRecord(domain: string): Promise<boolean>;
}

export function createSystemDnsDeps(timeoutMs = 3000): DnsDeps {
  const r = new DnsResolver({ timeout: timeoutMs, tries: 2 });
  return {
    resolve4: (h) => r.resolve4(h),
    resolve6: (h) => r.resolve6(h),
    resolveMx: (h) => r.resolveMx(h),
    resolveTxt: (h) => r.resolveTxt(h),
    // Fixed, trusted DNS-over-HTTPS endpoint (not user controlled), so no SSRF exposure.
    hasDsRecord: async (domain) => {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DS`, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`DoH status ${res.status}`);
      const json = (await res.json()) as { Status: number; Answer?: { type: number }[] };
      if (json.Status !== 0 && json.Status !== 3) throw new Error(`DoH rcode ${json.Status}`);
      return !!json.Answer?.some((a) => a.type === 43);
    },
  };
}

const NO_DATA = ["ENODATA", "ENOTFOUND", "ENOENT"];
async function soft<T>(p: Promise<T>, empty: T): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    if (NO_DATA.includes(code)) return { ok: true, value: empty };
    return { ok: false, error: code };
  }
}

const joinTxt = (records: string[][]) => records.map((r) => r.join(""));

/** Module E — DNS and email-authentication configuration. */
export async function analyzeDns(hostname: string, registrableDomain: string, deps: DnsDeps): Promise<{ checks: CheckResult[]; findings: Finding[] }> {
  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const cat = "dns" as const;

  const [a, aaaa, mx, spfTxt, dmarcHost, dmarcOrg, ds] = await Promise.all([
    soft(deps.resolve4(hostname), [] as string[]),
    soft(deps.resolve6(hostname), [] as string[]),
    soft(deps.resolveMx(registrableDomain), [] as { exchange: string; priority: number }[]),
    soft(deps.resolveTxt(registrableDomain), [] as string[][]),
    soft(deps.resolveTxt(`_dmarc.${hostname}`), [] as string[][]),
    hostname === registrableDomain ? Promise.resolve(null) : soft(deps.resolveTxt(`_dmarc.${registrableDomain}`), [] as string[][]),
    deps.hasDsRecord(registrableDomain).then((v) => ({ ok: true as const, value: v }), (e: Error) => ({ ok: false as const, error: e.message })),
  ]);

  // Address records (3)
  if (!a.ok && !aaaa.ok) checks.push(check("dns_address", cat, "Address records (A/AAAA)", 3, "unavailable", "DNS lookup failed.", { error: a.error }));
  else {
    const v4 = a.ok ? a.value : [];
    const v6 = aaaa.ok ? aaaa.value : [];
    const ev = { A: v4.slice(0, 8), AAAA: v6.slice(0, 8) };
    if (v4.length || v6.length) checks.push(check("dns_address", cat, "Address records (A/AAAA)", 3, "pass", `${v4.length} IPv4 and ${v6.length} IPv6 address(es).`, ev));
    else checks.push(check("dns_address", cat, "Address records (A/AAAA)", 3, "fail", "No address records found.", ev));
  }

  // MX (informational)
  const mxList = mx.ok ? mx.value.sort((x, y) => x.priority - y.priority).map((m) => m.exchange).slice(0, 10) : [];
  const hasMx = mxList.length > 0;
  checks.push(
    mx.ok
      ? check("dns_mx", cat, "Mail exchangers (MX)", 0, "info", hasMx ? `${mxList.length} mail server(s) configured.` : "No MX records (domain does not appear to receive email).", { MX: mxList, domain: registrableDomain })
      : check("dns_mx", cat, "Mail exchangers (MX)", 0, "unavailable", "MX lookup failed.", { error: mx.error }),
  );

  // SPF (4)
  if (!spfTxt.ok) checks.push(check("spf", cat, "SPF record", 4, "unavailable", "TXT lookup failed.", { error: spfTxt.error }));
  else {
    const spf = joinTxt(spfTxt.value).filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
    const ev = { domain: registrableDomain, records: spf.map((s) => s.slice(0, 300)) };
    if (!spf.length) {
      checks.push(check("spf", cat, "SPF record", 4, "fail", "No SPF record.", ev));
      findings.push(makeFinding("spf_missing", `No SPF record found for ${registrableDomain}${hasMx ? "" : " (the domain has no MX records)"}.`, ev, hasMx ? {} : { severity: "informational" }));
    } else if (spf.length > 1) {
      checks.push(check("spf", cat, "SPF record", 4, "warn", "Multiple SPF records (invalid).", ev, 1));
      findings.push(makeFinding("spf_permissive", `${spf.length} SPF records were found; only one is permitted.`, ev));
    } else if (/[+?]all\b|\sall\s*$/i.test(spf[0]) || !/[-~]all\b|redirect=/i.test(spf[0])) {
      checks.push(check("spf", cat, "SPF record", 4, "warn", "SPF present but permissive.", ev, 2));
      findings.push(makeFinding("spf_permissive", `SPF record: ${spf[0].slice(0, 160)}`, ev));
    } else {
      checks.push(check("spf", cat, "SPF record", 4, "pass", "SPF record present.", ev));
    }
  }

  // DMARC (5)
  const dmarcSource = dmarcHost.ok && joinTxt(dmarcHost.value).some((t) => /^v=DMARC1/i.test(t.trim()))
    ? { domain: `_dmarc.${hostname}`, res: dmarcHost }
    : dmarcOrg
      ? { domain: `_dmarc.${registrableDomain}`, res: dmarcOrg }
      : { domain: `_dmarc.${hostname}`, res: dmarcHost };
  if (!dmarcSource.res.ok) checks.push(check("dmarc", cat, "DMARC policy", 5, "unavailable", "DMARC lookup failed.", { error: dmarcSource.res.error }));
  else {
    const rec = joinTxt(dmarcSource.res.value).find((t) => /^v=DMARC1/i.test(t.trim()));
    const ev = { record: rec?.slice(0, 300), lookedUp: dmarcSource.domain };
    if (!rec) {
      checks.push(check("dmarc", cat, "DMARC policy", 5, "fail", "No DMARC record.", ev));
      findings.push(makeFinding("dmarc_missing", `No DMARC record at ${dmarcSource.domain}.`, ev, hasMx ? {} : { severity: "informational" }));
    } else {
      const p = /\bp\s*=\s*(\w+)/i.exec(rec)?.[1]?.toLowerCase();
      if (p === "reject" || p === "quarantine") checks.push(check("dmarc", cat, "DMARC policy", 5, "pass", `DMARC policy p=${p}.`, ev));
      else {
        checks.push(check("dmarc", cat, "DMARC policy", 5, "warn", `DMARC policy p=${p ?? "missing"} (monitoring only).`, ev, 2));
        findings.push(makeFinding("dmarc_monitor", `DMARC record found with p=${p ?? "missing"}.`, ev));
      }
    }
  }

  // DNSSEC (3)
  if (!ds.ok) checks.push(check("dnssec", cat, "DNSSEC", 3, "unavailable", "DNSSEC status could not be determined.", { error: ds.error }));
  else if (ds.value) checks.push(check("dnssec", cat, "DNSSEC", 3, "pass", "DS record present (DNSSEC signed delegation).", { domain: registrableDomain }));
  else {
    checks.push(check("dnssec", cat, "DNSSEC", 3, "fail", "No DS record found.", { domain: registrableDomain }));
    findings.push(makeFinding("dnssec_absent", `No DS record published for ${registrableDomain}.`, { domain: registrableDomain }));
  }

  return { checks, findings };
}
