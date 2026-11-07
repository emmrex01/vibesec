"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={async () => {
        await createBrowserSupabase().auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      <LogOut /> Sign out
    </Button>
  );
}
