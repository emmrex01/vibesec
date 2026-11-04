import { ArrowRight, Bot, Building2, CheckCircle2, Cookie, CreditCard, FileText, Globe, KeyRound, Layers, Lock, Mail, Server, ShieldCheck, Store, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { AssessmentForm } from "@/components/forms/assessment-form";
import { HeroVisual } from "@/components/landing/hero-visual";
import { SectionHeading } from "@/components/landing/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const CHECKS = [
  { icon: Lock, title: "HTTPS & TLS", text: "HTTPS availability, HTTP→HTTPS redirects, certificate trust, hostname match and expiry." },
  { icon: Server, title: "Security headers", text: "HSTS, Content-Security-Policy, X-Content-Type-Options, clickjacking protection, Referrer-Policy and more." },
  { icon: Cookie, title: "Cookie configuration", text: "Secure, HttpOnly and SameSite attributes on cookies set by your homepage. Cookie values are never stored." },
  { icon: Mail, title: "DNS & email domain", text: "Address records, SPF, DMARC and DNSSEC indicators that protect your domain from spoofing." },
  { icon: Globe, title: "Website configuration", text: "Availability, redirect behaviour, server version disclosure and insecure mixed content." },
  { icon: Layers, title: "Technology indicators", text: "Passive hosting, framework and platform indicators — reported as observations, never assumptions." },
];

const STEPS = [
  { n: "01", title: "Tell us about your site", text: "Enter your website URL and business details, and confirm you're authorized to request the check." },
  { n: "02", title: "We run passive checks", text: "A small number of standard requests to your public homepage, TLS endpoint and DNS. Nothing is attacked or submitted." },
  { n: "03", title: "Get your report", text: "A scored, evidence-based report with plain-English explanations and practical fixes — online and as a PDF." },
  { n: "04", title: "Fix with confidence", text: "Resolve findings yourself, or ask VibeSec for a professional assessment and hands-on remediation." },
];

const AUDIENCE = [
  { icon: Bot, title: "AI-built app founders", text: "Lovable, Bolt.new, Replit and Base44 builders shipping fast." },
  { icon: Layers, title: "Supabase & SaaS teams", text: "Startups handling user accounts, subscriptions and customer data." },
  { icon: Building2, title: "Agencies", text: "Web and product agencies who want a second pair of eyes on client launches." },
  { icon: Store, title: "E-commerce", text: "Shops processing payments and storing customer details." },
  { icon: CreditCard, title: "Fintech & healthtech", text: "Teams where trust and data protection are part of the product." },
  { icon: Users, title: "CTOs & technical leads", text: "Anyone preparing to scale, raise funding or pass a security questionnaire." },
];

const FAQ = [
  { q: "Is the check really free?", a: "Yes. The preliminary automated health check and report are free. Professional assessments and remediation are paid services we'll only discuss if you ask." },
  { q: "Will the check harm or slow down my website?", a: "No. We make a handful of ordinary requests — the same a browser would — to your homepage, plus DNS lookups. We don't submit forms, log in, crawl, brute-force or attempt exploits." },
  { q: "Can I check a website I don't own?", a: "Only if you have the owner's authorization. You must confirm this before every assessment, and we record that confirmation." },
  { q: "Does a good score mean my site is secure?", a: "No. The score reflects a limited set of configuration checks on public information. Many important risks — such as access-control flaws, exposed database tables or insecure APIs — can only be found through an authorized, deeper assessment." },
  { q: "My app was built with Lovable / Bolt / Replit / Base44. Is it insecure?", a: "Not necessarily. AI-assisted tools can produce perfectly secure apps. But fast development often skips reviews of database permissions, RLS policies and API authorization, which is exactly what our professional services cover." },
  { q: "What do you do with my information?", a: "We use it to run the assessment, deliver your report and respond to you. We don't sell it, and you can request deletion at any time. Marketing emails are opt-in only." },
];

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="container relative grid items-center gap-14 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div className="space-y-7">
            <p className="inline-flex items-center gap-2 rounded-full border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-cyan-400" aria-hidden /> Independent security for modern web apps
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Is Your Website <span className="bg-gradient-to-r from-accent to-cyan-400 bg-clip-text text-transparent">Really Secure?</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Get a free preliminary security health check. Discover important security configuration issues and learn what you can do to protect your website and your users.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="#free-assessment" className={buttonVariants({ size: "lg" })}>Check My Website for Free <ArrowRight /></Link>
              <Link href="/services" className={buttonVariants({ size: "lg", variant: "outline" })}>Explore Our Security Services</Link>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Passive & non-intrusive", "Results in about a minute", "Downloadable PDF report"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-cyan-400" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* 2. Free assessment */}
      <section id="free-assessment" className="section scroll-mt-16 border-y bg-navy-900/40">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <SectionHeading eyebrow="Free security assessment" title="Get Your Free Security Health Check" description="Five short steps. We check your public homepage configuration and send you a clear, evidence-based report." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-emerald-400" /> Included</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>HTTPS, TLS & certificate checks</li><li>Security header review</li><li>Cookie attribute review</li><li>SPF, DMARC & DNSSEC indicators</li><li>Scored report + PDF</li>
                </ul>
              </Card>
              <Card className="p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><XCircle className="size-4 text-sev-high" /> Not included</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>Penetration testing</li><li>Login or authenticated areas</li><li>Database / RLS policy review</li><li>API authorization testing</li><li>Compliance certification</li>
                </ul>
              </Card>
            </div>
          </div>
          <Card className="p-6 sm:p-8">
            <AssessmentForm compact />
          </Card>
        </div>
      </section>

      {/* 3. Why it matters */}
      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-2">
          <SectionHeading
            eyebrow="Why website security matters"
            title="Small configuration gaps become expensive later"
            description="Most security incidents in young products don't start with sophisticated attacks. They start with defaults nobody revisited: a missing header, an over-permissive database policy, a webhook nobody verified."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Users, t: "Your users trust you", d: "Customers hand you their data. A single exposure can cost that trust — and your growth." },
              { icon: KeyRound, t: "Speed skips reviews", d: "AI-assisted and no-code tools ship features fast. Security reviews of auth and data access often don't keep up." },
              { icon: FileText, t: "Buyers will ask", d: "Enterprise customers and investors increasingly send security questionnaires before signing." },
              { icon: ShieldCheck, t: "Fixing early is cheaper", d: "Hardening before you scale costs a fraction of responding to an incident afterwards." },
            ].map((c) => (
              <Card key={c.t} className="p-5">
                <c.icon className="size-5 text-cyan-400" aria-hidden />
                <p className="mt-3 font-semibold">{c.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="container mt-16">
          <h3 className="text-lg font-semibold">Common configuration weaknesses we see</h3>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            {[
              "No HSTS header, so first visits can be downgraded to HTTP",
              "No Content-Security-Policy to limit injected scripts",
              "Session cookies readable by JavaScript",
              "Missing SPF / DMARC, making email spoofing easier",
              "Server software versions advertised in headers",
              "Scripts or styles loaded over insecure HTTP",
            ].map((w) => (
              <li key={w} className="flex gap-2 rounded-lg border bg-card/40 p-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />{w}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. What we check */}
      <section id="what-we-check" className="section scroll-mt-16 border-y bg-navy-900/40">
        <div className="container">
          <SectionHeading center eyebrow="What we check" title="Six areas, all passive" description="Every check is safe, read-only and limited to publicly accessible information about your homepage and domain." />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((c) => (
              <Card key={c.title} className="p-6 transition-colors hover:border-primary/40">
                <div className="inline-flex rounded-lg border bg-secondary/50 p-2.5"><c.icon className="size-5 text-cyan-400" aria-hidden /></div>
                <p className="mt-4 font-semibold">{c.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How it works */}
      <section id="how-it-works" className="section scroll-mt-16">
        <div className="container">
          <SectionHeading eyebrow="How the assessment works" title="From URL to report in about a minute" />
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="relative rounded-xl border bg-card/50 p-6">
                <span className="font-mono text-sm text-cyan-400">{s.n}</span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Who should use it */}
      <section className="section border-y bg-navy-900/40">
        <div className="container">
          <SectionHeading center eyebrow="Who it's for" title="Built for teams shipping real products" description="Especially founders who want to review application security before scaling." />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="flex gap-4 rounded-xl border bg-card/40 p-5">
                <a.icon className="mt-0.5 size-5 shrink-0 text-cyan-400" aria-hidden />
                <div><p className="font-semibold">{a.title}</p><p className="mt-1 text-sm text-muted-foreground">{a.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Services */}
      <section className="section">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow={`${settings.businessName} professional services`} title="When you need more than a health check" description="We help resolve what automated checks find — and investigate what they can't see." />
            <Link href="/services" className={buttonVariants({ variant: "outline" })}>All services <ArrowRight /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {settings.services.slice(0, 6).map((s) => (
              <Card key={s.slug} className="p-5">
                <p className="font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="section border-y bg-navy-900/40">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
          <div className="divide-y rounded-xl border bg-card/40">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">{f.q}<span className="text-cyan-400 transition-transform group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Contact CTA */}
      <section className="section">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-navy-800 to-navy-900 p-10 text-center sm:p-14">
            <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
            <div className="relative mx-auto max-w-2xl space-y-5">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Know Your Website&apos;s Security Health Before Problems Become Expensive.</h2>
              <p className="text-muted-foreground">Start with a free check, or talk to us about a professional assessment of your application.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/assessment" className={buttonVariants({ size: "lg" })}>Get Your Free Security Health Check</Link>
                <Link href="/contact" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>Discuss Your Website Security With {settings.businessName}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
