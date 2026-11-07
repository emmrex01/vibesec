import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Security Services", description: "Professional application security assessments, Supabase and RLS reviews, remediation and hardening." };

const FUTURE = ["Authorized Supabase security assessments", "Scheduled monitoring and monthly reports", "White-label reports for agencies"];

export default async function ServicesPage() {
  const settings = await getSettings();
  return (
    <div className="container py-16 sm:py-24">
      <div className="max-w-2xl space-y-4">
        <p className="eyebrow">Professional services</p>
        <h1 className="text-4xl font-semibold tracking-tight">Security expertise for modern and AI-built applications</h1>
        <p className="text-muted-foreground">
          Automated checks only see what&apos;s public. Our professional services go deeper — with your authorization and an agreed scope — into
          authentication, authorization, database access, APIs and payments.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {settings.services.map((s) => (
          <Card key={s.slug} className="flex flex-col p-6">
            <ShieldCheck className="size-5 text-cyan-400" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <Link href={`/contact?service=${encodeURIComponent(s.title)}&source=services`} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:underline">
              Discuss this service <ArrowRight className="size-4" />
            </Link>
          </Card>
        ))}
      </div>
      <div className="mt-16 grid gap-8 rounded-2xl border bg-card/50 p-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">How engagements work</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>A short call to understand your application, stack and goals.</li>
            <li>A written scope and authorization agreement before any testing.</li>
            <li>Assessment, with critical issues reported immediately.</li>
            <li>A clear report, remediation support and re-testing.</li>
          </ol>
        </div>
        <div>
          <h2 className="text-2xl font-semibold">On our roadmap</h2>
          <p className="mt-2 text-sm text-muted-foreground">Not yet available as self-service products — ask us if you&apos;re interested.</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">{FUTURE.map((f) => <li key={f}>• {f}</li>)}</ul>
        </div>
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/contact?source=services" className={buttonVariants({ size: "lg" })}>Request a Professional Security Assessment</Link>
        <Link href="/assessment" className={buttonVariants({ size: "lg", variant: "outline" })}>Start with a free health check</Link>
      </div>
    </div>
  );
}
