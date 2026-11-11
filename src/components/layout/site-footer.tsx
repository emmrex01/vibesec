import Link from "next/link";
import type { SiteSettings } from "@/config/defaults";
import { whatsappLink } from "@/lib/utils";
import { Logo } from "./logo";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const wa = whatsappLink(settings.whatsappNumber);
  return (
    <footer className="border-t border-border/60 bg-navy-950">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo name={settings.businessName} />
          <p className="max-w-sm text-sm text-muted-foreground">Know Your Website&apos;s Security Health Before Problems Become Expensive.</p>
          <p className="max-w-md text-xs text-muted-foreground/80">
            Independent application security assessments for modern websites, SaaS platforms and AI-built applications.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Product</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/assessment">Free security health check</Link></li>
            <li><Link className="hover:text-foreground" href="/services">Professional services</Link></li>
            <li><Link className="hover:text-foreground" href="/about">About</Link></li>
            <li><Link className="hover:text-foreground" href="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Trust &amp; legal</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-foreground" href="/terms">Terms of service</Link></li>
            <li><Link className="hover:text-foreground" href="/disclaimer">Assessment disclaimer</Link></li>
            <li><Link className="hover:text-foreground" href="/privacy#deletion">Request data deletion</Link></li>
          </ul>
          {(settings.contactEmail || wa) && (
            <div className="mt-5 space-y-1 text-sm text-muted-foreground">
              {settings.contactEmail && <a className="block hover:text-foreground" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
              {wa && <a className="block hover:text-foreground" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.businessName}. All rights reserved.</p>
          <p>Automated checks are preliminary and do not replace a full security audit.</p>
        </div>
      </div>
    </footer>
  );
}
