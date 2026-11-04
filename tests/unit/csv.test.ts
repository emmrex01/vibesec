import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => ({}) }));
import { sanitizeSearch, toCsv } from "@/lib/admin/queries";

describe("CSV export", () => {
  it("escapes quotes/commas and neutralises spreadsheet formulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("http://x")', b: "Smith, John", c: "+1", d: "@SUM(A1)", e: 'He said "hi"' }], ["a", "b", "c", "d", "e"].map((k) => ({ key: k, label: k })));
    const row = csv.split("\r\n")[1];
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain('"Smith, John"');
    expect(row).toContain("'+1");
    expect(row).toContain("'@SUM(A1)");
    expect(row).toContain('"He said ""hi"""');
  });
  it("strips PostgREST filter syntax from search terms", () => {
    expect(sanitizeSearch("a@b.com,status.eq.converted)")).toBe("a@b.comstatus.eq.converted");
    expect(sanitizeSearch("x%*()")).toBe("x");
  });
});
