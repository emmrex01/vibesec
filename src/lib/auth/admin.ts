import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, publicEnv } from "@/config/env";
import { errorJson, isSameOrigin } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Server-side authorisation: a valid Supabase session (verified with the Auth server via getUser)
 * AND profiles.role = 'admin'. Hidden navigation is never relied on.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile } = await createServiceClient().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (profile?.role !== "admin") return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch {
    return null;
  }
}

export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For route handlers. Returns the admin, or a ready-made 401/403 response. */
export async function requireAdminApi(req: Request, opts: { mutation?: boolean } = {}): Promise<AdminUser | Response> {
  if (opts.mutation && !isSameOrigin(req, publicEnv.siteUrl)) return errorJson(403, "forbidden", "Cross-site request rejected.");
  const admin = await getAdmin();
  if (!admin) return errorJson(401, "unauthorized", "Administrator sign-in required.");
  return admin;
}
