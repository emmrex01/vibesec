import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/login-form";
import { Logo } from "@/components/layout/logo";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/config/env";
import { getAdmin } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const configured = isSupabaseConfigured();
  let denied = false;
  if (configured) {
    if (await getAdmin()) redirect("/admin/dashboard");
    const { data } = await (await createSessionClient()).auth.getUser();
    denied = !!data.user; // signed in, but not an admin
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 space-y-3">
          <Logo />
          <h1 className="text-xl font-semibold">Administrator sign in</h1>
          <p className="text-sm text-muted-foreground">Restricted to authorized VibeSec staff.</p>
        </div>
        <LoginForm configured={configured} denied={denied} />
      </Card>
    </div>
  );
}
