import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/config/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS — use ONLY in server code after validating input
 * and authorising the caller. Never import from client components.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  const key = serverEnv().supabaseServiceRoleKey;
  if (!publicEnv.supabaseUrl || !key) throw new Error("Supabase is not configured");
  cached = createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
