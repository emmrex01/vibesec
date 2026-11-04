/**
 * Applies the real Supabase migration to an embedded Postgres (PGlite) with a minimal
 * emulation of Supabase's auth schema and roles, then verifies Row Level Security.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const VIEWER = "00000000-0000-4000-8000-0000000000b2";
let db: PGlite;

async function as<T>(role: "anon" | "authenticated" | "service_role", uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  await db.exec(readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@vibesec.test'), ('${VIEWER}', 'viewer@vibesec.test');
    update public.profiles set role = 'admin' where id = '${ADMIN}';
    insert into public.leads (id, full_name, email, company, country, target_url, target_domain, authorization_confirmed)
      values ('11111111-1111-4111-8111-111111111111', 'Ada', 'ada@x.com', 'X', 'United Kingdom', 'https://x.com/', 'x.com', true);
  `);
});
afterAll(async () => db?.close());

describe("database Row Level Security", () => {
  it("creates a non-privileged profile for new auth users via trigger", async () => {
    const r = await db.query<{ role: string }>(`select role from public.profiles where id = '${VIEWER}'`);
    expect(r.rows[0].role).toBe("viewer");
  });

  it("anonymous clients cannot read or write any table", async () => {
    for (const table of ["leads", "assessments", "reports", "consultation_requests", "admin_notes", "consent_records", "app_settings", "profiles"]) {
      await expect(as("anon", null, () => db.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
    await expect(as("anon", null, () => db.query(`insert into public.consultation_requests (full_name, email, message) values ('x','x@y.z','spam')`))).rejects.toThrow(/permission denied/);
  });

  it("authenticated non-admins see nothing and cannot modify leads", async () => {
    const rows = await as("authenticated", VIEWER, () => db.query("select * from public.leads"));
    expect(rows.rows).toHaveLength(0);
    const upd = await as("authenticated", VIEWER, () => db.query("update public.leads set status = 'converted' returning id"));
    expect(upd.rows).toHaveLength(0);
    await expect(as("authenticated", VIEWER, () => db.query(`insert into public.admin_notes (lead_id, body) values ('11111111-1111-4111-8111-111111111111', 'x')`))).rejects.toThrow(/row-level security/);
  });

  it("non-admins can read only their own profile and cannot escalate their role", async () => {
    const own = await as("authenticated", VIEWER, () => db.query("select id from public.profiles"));
    expect(own.rows).toHaveLength(1);
    const upd = await as("authenticated", VIEWER, () => db.query(`update public.profiles set role = 'admin' where id = '${VIEWER}' returning id`));
    expect(upd.rows).toHaveLength(0);
    const r = await db.query<{ role: string }>(`select role from public.profiles where id = '${VIEWER}'`);
    expect(r.rows[0].role).toBe("viewer");
  });

  it("even admins cannot change roles from a client session", async () => {
    const upd = await as("authenticated", ADMIN, () => db.query(`update public.profiles set role = 'admin' where id = '${VIEWER}' returning id`));
    expect(upd.rows).toHaveLength(0);
    const r = await db.query<{ role: string }>(`select role from public.profiles where id = '${VIEWER}'`);
    expect(r.rows[0].role).toBe("viewer");
  });

  it("the role-protection trigger blocks changes by any non-service database role", async () => {
    await db.exec("create role tmp_editor nologin; grant update, select on public.profiles to tmp_editor; create policy tmp_all on public.profiles for update to tmp_editor using (true); create policy tmp_sel on public.profiles for select to tmp_editor using (true);");
    await db.exec("set role tmp_editor");
    try {
      await expect(db.query(`update public.profiles set role = 'admin' where id = '${VIEWER}'`)).rejects.toThrow(/service role/);
    } finally {
      await db.exec("reset role; drop policy tmp_all on public.profiles; drop policy tmp_sel on public.profiles; revoke all on public.profiles from tmp_editor; drop role tmp_editor;");
    }
  });

  it("admins can read and manage CRM data", async () => {
    const rows = await as("authenticated", ADMIN, () => db.query("select email from public.leads"));
    expect(rows.rows).toHaveLength(1);
    const upd = await as("authenticated", ADMIN, () => db.query("update public.leads set status = 'contacted' returning status"));
    expect(upd.rows).toHaveLength(1);
  });

  it("privileged helper functions are not callable by anon or authenticated users", async () => {
    await expect(as("anon", null, () => db.query("select public.check_rate_limit('k', 1, 60)"))).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", VIEWER, () => db.query("select * from public.claim_assessment(gen_random_uuid(), now(), 3)"))).rejects.toThrow(/permission denied/);
  });

  it("the service role (server only) bypasses RLS and the rate limiter works atomically", async () => {
    const leads = await as("service_role", null, () => db.query("select id from public.leads"));
    expect(leads.rows).toHaveLength(1);
    await db.exec("grant execute on function public.check_rate_limit(text, integer, integer) to service_role;");
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await as("service_role", null, () => db.query<{ ok: boolean }>("select public.check_rate_limit('ip:1', 2, 60) as ok"));
      results.push(r.rows[0].ok);
    }
    expect(results).toEqual([true, true, false]);
  });

  it("enforces data integrity constraints", async () => {
    await expect(db.query(`insert into public.leads (full_name, email, company, country, target_url, target_domain, authorization_confirmed) values ('a','a@b.c','c','UK','https://a.com/','a.com', false)`)).rejects.toThrow(/check/);
    await expect(db.query(`update public.app_settings set lead_retention_days = 1`)).rejects.toThrow(/check/);
  });
});
