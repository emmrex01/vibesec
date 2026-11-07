"use client";

import { BarChart3, FileText, Inbox, LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/assessments", label: "Assessments", icon: BarChart3 },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/consultations", label: "Requests", icon: Inbox },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
      {ITEMS.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground", active && "bg-secondary text-foreground")}
          >
            <i.icon className="size-4" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
