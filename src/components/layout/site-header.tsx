"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/#what-we-check", label: "What we check" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-navy-950/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Logo name={businessName} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link href="/assessment" className={buttonVariants({ size: "sm" })}>
            Get Your Free Security Health Check
          </Link>
        </div>
        <button className="rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Toggle menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <nav id="mobile-nav" className={cn("border-t border-border/60 md:hidden", open ? "block" : "hidden")} aria-label="Mobile">
        <div className="container flex flex-col gap-1 py-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
          <Link href="/assessment" onClick={() => setOpen(false)} className={cn(buttonVariants(), "mt-2")}>
            Get Your Free Security Health Check
          </Link>
        </div>
      </nav>
    </header>
  );
}
