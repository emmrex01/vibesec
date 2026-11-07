import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AssessmentForm } from "@/components/forms/assessment-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Free Security Health Check",
  description: "Request a free, passive website security configuration assessment.",
};

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <div className="container max-w-3xl py-14 sm:py-20">
      <div className="mb-8 space-y-3">
        <p className="eyebrow">Free security assessment</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get Your Free Security Health Check</h1>
        <p className="text-muted-foreground">
          We&apos;ll run safe, passive checks against your public homepage and domain, then show you a scored report with practical recommendations.
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <AssessmentForm initialUrl={typeof url === "string" ? url.slice(0, 2048) : ""} />
      </Card>
      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden />
        This preliminary automated check is not a penetration test, compliance audit or guarantee of security.
      </p>
    </div>
  );
}
