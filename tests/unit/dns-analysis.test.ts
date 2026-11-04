import { describe, expect, it } from "vitest";
import { analyzeDns } from "@/lib/scanner/modules/dns";
import { mockDns } from "../helpers/mock-net";

const get = (r: Awaited<ReturnType<typeof analyzeDns>>, k: string) => r.checks.find((c) => c.key === k)!;

describe("analyzeDns", () => {
  it("passes strong configuration", async () => {
    const r = await analyzeDns("example.com", "example.com", mockDns({
      txt: { "example.com": [["v=spf1 include:_spf.google.com -all"]], "_dmarc.example.com": [["v=DMARC1; p=reject; rua=mailto:d@example.com"]] },
      ds: true,
    }));
    for (const k of ["dns_address", "spf", "dmarc", "dnssec"]) expect(get(r, k).status).toBe("pass");
    expect(get(r, "dns_mx").status).toBe("info");
    expect(r.findings).toHaveLength(0);
  });

  it("reports missing SPF/DMARC as low severity and DNSSEC as informational", async () => {
    const r = await analyzeDns("example.com", "example.com", mockDns());
    expect(r.findings.find((f) => f.key === "spf_missing")?.severity).toBe("low");
    expect(r.findings.find((f) => f.key === "dmarc_missing")?.severity).toBe("low");
    expect(r.findings.find((f) => f.key === "dnssec_absent")?.severity).toBe("informational");
  });

  it("downgrades email findings when the domain has no MX", async () => {
    const r = await analyzeDns("example.com", "example.com", mockDns({ mx: [] }));
    expect(r.findings.find((f) => f.key === "spf_missing")?.severity).toBe("informational");
  });

  it("detects permissive SPF, p=none DMARC and falls back to the org domain for DMARC", async () => {
    const r = await analyzeDns("app.example.com", "example.com", mockDns({
      txt: { "example.com": [["v=spf1 +all"]], "_dmarc.example.com": [["v=DMARC1; p=none"]] },
    }));
    expect(get(r, "spf").status).toBe("warn");
    expect(get(r, "dmarc").status).toBe("warn");
    expect(get(r, "dmarc").evidence.lookedUp).toBe("_dmarc.example.com");
  });

  it("marks DNSSEC unavailable (not failed) when the lookup errors", async () => {
    const r = await analyzeDns("example.com", "example.com", mockDns({ ds: new Error("DoH down") }));
    expect(get(r, "dnssec").status).toBe("unavailable");
  });
});
