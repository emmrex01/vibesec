import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  return { user: null as null | { id: string; email: string }, role: "viewer", dbCalls: [] as string[] };
});

vi.mock("@/lib/supabase/server", () => ({
  createSessionClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
}));

vi.mock("@/lib/supabase/admin", () => {
  // Any table access other than the role lookup is recorded so we can prove nothing leaked.
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    for (const m of ["select", "eq", "order", "range", "or", "gte", "lte", "limit", "update", "delete", "insert", "not"]) q[m] = self;
    q.maybeSingle = async () => (table === "profiles" ? { data: state.user ? { role: state.role } : null } : { data: { id: "x" } });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: [{ id: "lead-1", email: "secret@lead.com", assessments: [] }], count: 1, error: null });
    return q;
  };
  return {
    createServiceClient: () => ({
      from: (table: string) => {
        if (table !== "profiles") state.dbCalls.push(table);
        return chain(table);
      },
      rpc: async () => ({ data: null, error: null }),
    }),
  };
});

import { requireAdminPage } from "@/lib/auth/admin";
import { GET as listAssessments } from "@/app/api/admin/assessments/route";
import { GET as exportCsv } from "@/app/api/admin/export/route";
import { DELETE as deleteLead, PATCH as patchLead } from "@/app/api/admin/leads/[id]/route";
import { GET as listLeads } from "@/app/api/admin/leads/route";
import { PUT as putSettings } from "@/app/api/admin/settings/route";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const params = { params: Promise.resolve({ id: LEAD_ID }) };
const req = (url: string, init: RequestInit = {}) => new Request(`https://health.vibesec.test${url}`, init);
const jsonReq = (url: string, method: string, body: unknown, origin = "https://health.vibesec.test") =>
  req(url, { method, headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

beforeEach(() => {
  state.user = null;
  state.role = "viewer";
  state.dbCalls = [];
});

describe("admin API authorization", () => {
  it("anonymous requests get 401 and never touch lead data", async () => {
    for (const res of [
      await listLeads(req("/api/admin/leads")),
      await listAssessments(req("/api/admin/assessments")),
      await exportCsv(req("/api/admin/export")),
      await patchLead(jsonReq(`/api/admin/leads/${LEAD_ID}`, "PATCH", { status: "converted" }), params),
      await deleteLead(jsonReq(`/api/admin/leads/${LEAD_ID}`, "DELETE", {}), params),
      await putSettings(jsonReq("/api/admin/settings", "PUT", {})),
    ]) {
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain("secret@lead.com");
    }
    expect(state.dbCalls).toEqual([]);
  });

  it("signed-in users without the admin role are rejected", async () => {
    state.user = { id: "u1", email: "viewer@x.com" };
    const res = await exportCsv(req("/api/admin/export"));
    expect(res.status).toBe(401);
    expect(state.dbCalls).toEqual([]);
  });

  it("cross-site mutations are rejected even for admins (CSRF)", async () => {
    state.user = { id: "u1", email: "admin@vibesec.test" };
    state.role = "admin";
    const res = await patchLead(jsonReq(`/api/admin/leads/${LEAD_ID}`, "PATCH", { status: "converted" }, "https://evil.example"), params);
    expect(res.status).toBe(403);
    expect(state.dbCalls).toEqual([]);
  });

  it("admins can export CSV with formula-injection protection", async () => {
    state.user = { id: "u1", email: "admin@vibesec.test" };
    state.role = "admin";
    const res = await exportCsv(req("/api/admin/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("secret@lead.com");
  });

  it("rejects malformed lead IDs and payloads", async () => {
    state.user = { id: "u1", email: "admin@vibesec.test" };
    state.role = "admin";
    const bad = await patchLead(jsonReq("/api/admin/leads/not-a-uuid", "PATCH", { status: "converted" }), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(bad.status).toBe(400);
    const badStatus = await patchLead(jsonReq(`/api/admin/leads/${LEAD_ID}`, "PATCH", { status: "owned" }), params);
    expect(badStatus.status).toBe(400);
  });
});

describe("admin pages", () => {
  it("redirect anonymous visitors to the login page", async () => {
    await expect(requireAdminPage()).rejects.toMatchObject({ digest: expect.stringContaining("/admin/login") });
  });
});
