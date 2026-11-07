import type { Metadata } from "next";
import { CalendarDays, Globe, Mail, MessageCircle } from "lucide-react";
import { ConsultationForm } from "@/components/forms/consultation-form";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/utils";

export const metadata: Metadata = { title: "Contact", description: "Request a consultation or discuss your website security with VibeSec." };

const SOURCES = ["contact_page", "report", "services", "homepage"] as const;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ service?: string; source?: string }> }) {
  const [settings, sp] = await Promise.all([getSettings(), searchParams]);
  const wa = whatsappLink(settings.whatsappNumber);
  const source = (SOURCES as readonly string[]).includes(sp.source ?? "") ? (sp.source as (typeof SOURCES)[number]) : "contact_page";
  return (
    <div className="container py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <p className="eyebrow">Contact</p>
          <h1 className="text-4xl font-semibold tracking-tight">Discuss Your Website Security With {settings.businessName}</h1>
          <p className="text-muted-foreground">
            Tell us about your application and what you&apos;d like help with — a professional assessment, a Supabase / RLS review, or hands-on fixes for
            findings from your health check.
          </p>
          <div className="space-y-3 text-sm">
            {settings.contactEmail && (
              <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-3 rounded-lg border bg-card/50 p-4 hover:border-primary/40">
                <Mail className="size-5 text-cyan-400" /> {settings.contactEmail}
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border bg-card/50 p-4 hover:border-primary/40">
                <MessageCircle className="size-5 text-cyan-400" /> WhatsApp {settings.whatsappNumber}
              </a>
            )}
            {settings.bookingUrl && (
              <a href={settings.bookingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border bg-card/50 p-4 hover:border-primary/40">
                <CalendarDays className="size-5 text-cyan-400" /> Book a call
              </a>
            )}
            {settings.websiteUrl && (
              <a href={settings.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border bg-card/50 p-4 hover:border-primary/40">
                <Globe className="size-5 text-cyan-400" /> {settings.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-semibold">Request a consultation</h2>
          <ConsultationForm source={source} defaultService={sp.service} />
        </Card>
      </div>
    </div>
  );
}
