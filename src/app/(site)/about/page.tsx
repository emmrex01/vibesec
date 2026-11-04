import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "About", description: "Independent application security for modern websites, SaaS platforms and AI-built applications." };

export default async function AboutPage() {
  const { businessName } = await getSettings();
  return (
    <div className="container max-w-3xl py-16 sm:py-24">
      <p className="eyebrow">About {businessName}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Independent application security assessments for modern websites, SaaS platforms and AI-built applications.</h1>
      <div className="mt-8 space-y-5 text-muted-foreground">
        <p>
          Building software has never been faster. Tools like Lovable, Bolt.new, Replit, Base44 and Supabase let small teams ship real products in
          days. What often doesn&apos;t keep up is the review of how those products handle authentication, permissions, payments and customer data.
        </p>
        <p>
          {businessName} exists to close that gap. We help founders, startups, SaaS businesses and development agencies find and fix application
          security weaknesses — practically, without fear-mongering, and in language that non-specialists can act on.
        </p>
        <h2 className="pt-4 text-xl font-semibold text-foreground">How we work</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><span className="text-foreground">Evidence first.</span> We report what we observe, with the evidence, and we&apos;re explicit about the limits of each check.</li>
          <li><span className="text-foreground">Authorization always.</span> We only assess systems the owner has authorized us to assess, within an agreed scope.</li>
          <li><span className="text-foreground">Fixes, not just findings.</span> We help you resolve issues and re-test to confirm they&apos;re fixed.</li>
          <li><span className="text-foreground">Privacy by design.</span> We collect the minimum information needed and never sell it.</li>
        </ul>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/assessment" className={buttonVariants()}>Get Your Free Security Health Check</Link>
        <Link href="/contact" className={buttonVariants({ variant: "outline" })}>Contact us</Link>
      </div>
    </div>
  );
}
