"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/config/env";

/** Browser client — used ONLY for admin sign-in/sign-out. It has no table access (RLS + revoked grants). */
export function createBrowserSupabase() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
