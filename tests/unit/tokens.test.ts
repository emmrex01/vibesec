import { describe, expect, it } from "vitest";
import { bearerToken, generateReportNumber, generateReportToken, hashIp, hashToken, isWellFormedToken } from "@/lib/security/tokens";

describe("report tokens", () => {
  it("are 256-bit URL-safe and unique", () => {
    const set = new Set(Array.from({ length: 200 }, generateReportToken));
    expect(set.size).toBe(200);
    for (const t of set) expect(isWellFormedToken(t)).toBe(true);
  });
  it("are stored only as SHA-256 hashes", () => {
    const t = generateReportToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
  it("rejects malformed tokens", () => {
    for (const bad of ["", "abc", "x".repeat(44), "../../etc/passwd", "a".repeat(42) + "!", null, undefined]) expect(isWellFormedToken(bad as string)).toBe(false);
  });
  it("parses bearer headers strictly", () => {
    expect(bearerToken("Bearer abc_DEF-123")).toBe("abc_DEF-123");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
  it("produces readable report numbers and salted IP hashes", () => {
    expect(generateReportNumber(new Date("2026-11-04"))).toMatch(/^VSH-2026-[A-Z2-9]{8}$/);
    expect(hashIp("1.2.3.4", "s1")).not.toBe(hashIp("1.2.3.4", "s2"));
    expect(hashIp(null, "s")).toBeNull();
  });
});
