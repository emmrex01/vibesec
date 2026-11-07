"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettings } from "@/config/defaults";
import { postJson } from "@/lib/client-api";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; fields?: Record<string, string> } | null>(null);
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const f = msg?.fields ?? {};

  return (
    <form
      className="space-y-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await postJson("/api/admin/settings", {
          businessName: s.businessName,
          logoUrl: s.logoUrl ?? "",
          contactEmail: s.contactEmail ?? "",
          whatsappNumber: s.whatsappNumber ?? "",
          websiteUrl: s.websiteUrl ?? "",
          bookingUrl: s.bookingUrl ?? "",
          assessmentDisclaimer: s.assessmentDisclaimer ?? "",
          emailFromName: s.emailFromName ?? "",
          emailFromAddress: s.emailFromAddress ?? "",
          reportBrandColor: s.reportBrandColor,
          leadRetentionDays: s.leadRetentionDays,
          services: s.services,
        }, { method: "PUT" });
        setBusy(false);
        setMsg(res.ok ? { ok: true, text: "Settings saved." } : { ok: false, text: res.error.message, fields: res.error.fields });
        if (res.ok) router.refresh();
      }}
    >
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Business & contact</h2>
        <Field id="businessName" label="Business name" required error={f.businessName}><Input id="businessName" value={s.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
        <Field id="logoUrl" label="Brand logo URL" error={f.logoUrl}><Input id="logoUrl" value={s.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} /></Field>
        <Field id="contactEmail" label="Contact email" error={f.contactEmail}><Input id="contactEmail" type="email" value={s.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
        <Field id="whatsappNumber" label="WhatsApp number" hint="International format, e.g. +44 7…" error={f.whatsappNumber}><Input id="whatsappNumber" value={s.whatsappNumber ?? ""} onChange={(e) => set("whatsappNumber", e.target.value)} /></Field>
        <Field id="websiteUrl" label="Website address" error={f.websiteUrl}><Input id="websiteUrl" value={s.websiteUrl ?? ""} onChange={(e) => set("websiteUrl", e.target.value)} /></Field>
        <Field id="bookingUrl" label="Booking URL" error={f.bookingUrl}><Input id="bookingUrl" value={s.bookingUrl ?? ""} onChange={(e) => set("bookingUrl", e.target.value)} /></Field>
      </Card>
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Email, reports & retention</h2>
        <Field id="emailFromName" label="Email sender name" error={f.emailFromName}><Input id="emailFromName" value={s.emailFromName ?? ""} onChange={(e) => set("emailFromName", e.target.value)} /></Field>
        <Field id="emailFromAddress" label="Email sender address" hint="Must be a domain verified in Resend" error={f.emailFromAddress}><Input id="emailFromAddress" type="email" value={s.emailFromAddress ?? ""} onChange={(e) => set("emailFromAddress", e.target.value)} /></Field>
        <Field id="reportBrandColor" label="Report brand colour" required error={f.reportBrandColor}><Input id="reportBrandColor" value={s.reportBrandColor} onChange={(e) => set("reportBrandColor", e.target.value)} /></Field>
        <Field id="leadRetentionDays" label="Lead retention (days)" required error={f.leadRetentionDays}><Input id="leadRetentionDays" type="number" min={30} max={3650} value={s.leadRetentionDays} onChange={(e) => set("leadRetentionDays", Number(e.target.value))} /></Field>
        <div className="sm:col-span-2">
          <Field id="assessmentDisclaimer" label="Assessment disclaimer" error={f.assessmentDisclaimer}><Textarea id="assessmentDisclaimer" value={s.assessmentDisclaimer} onChange={(e) => set("assessmentDisclaimer", e.target.value)} /></Field>
        </div>
      </Card>
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Service descriptions</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => set("services", [...s.services, { slug: `service-${s.services.length + 1}`, title: "", description: "" }])}><Plus /> Add</Button>
        </div>
        {s.services.map((svc, i) => (
          <div key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_2fr_auto]">
            <Input aria-label="Service title" placeholder="Title" value={svc.title} onChange={(e) => set("services", s.services.map((x, j) => (j === i ? { ...x, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || x.slug } : x)))} />
            <Input aria-label="Service description" placeholder="Description" value={svc.description} onChange={(e) => set("services", s.services.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <Button type="button" size="icon" variant="ghost" aria-label="Remove service" onClick={() => set("services", s.services.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
      </Card>
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.text}</Alert>}
      <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save settings</Button>
    </form>
  );
}
