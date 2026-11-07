import type { Metadata } from "next";
import { AdminNav } from "@/components/dashboard/admin-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Logo } from "@/components/layout/logo";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b bg-navy-950 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
          <Logo href="/admin/dashboard" />
        </div>
        <AdminNav />
        <div className="mt-4 border-t pt-4 lg:absolute lg:bottom-4 lg:left-4 lg:right-4">
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground" title={admin.email}>{admin.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
