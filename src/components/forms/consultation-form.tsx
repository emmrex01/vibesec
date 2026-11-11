"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client-api";
import { consultationSchema, SERVICE_OPTIONS } from "@/lib/validation/schemas";
import { Turnstile, turnstileEnabled } from "./turnstile";

const formSchema = consultationSchema.omit({ turnstileToken: true });
type In = z.input<typeof formSchema>;
type Out = z.output<typeof formSchema>;

export function ConsultationForm({ source = "contact_page", defaultService }: { source?: Out["source"]; defaultService?: string }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);
  const { register, handleSubmit, formState, setError } = useForm<In, unknown, Out>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: "", email: "", company: "", website: "", message: "", service: (SERVICE_OPTIONS as readonly string[]).includes(defaultService ?? "") ? (defaultService as Out["service"]) : undefined, source, company_fax: "" },
  });
  const e = formState.errors;

  const onSubmit = async (values: Out) => {
    if (turnstileEnabled() && !token) return setServerError("Please complete the bot protection check.");
    setServerError(null);
    const res = await postJson("/api/contact", { ...values, turnstileToken: token ?? undefined });
    if (res.ok) return setDone(true);
    setServerError(res.error.message);
    for (const [f, m] of Object.entries(res.error.fields ?? {})) setError(f as FieldPath<In>, { message: m });
  };

  if (done) {
    return (
      <Alert variant="success" className="flex items-start gap-3 p-5">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Thanks — your request has been received.</p>
          <p className="mt-1 text-emerald-200/80">A member of the team will reply to your business email, usually within one working day.</p>
        </div>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Consultation request">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input tabIndex={-1} autoComplete="off" {...register("company_fax")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label="Full name" required error={e.fullName?.message}>
          <Input id="c-name" autoComplete="name" aria-invalid={!!e.fullName} {...register("fullName")} />
        </Field>
        <Field id="c-email" label="Business email" required error={e.email?.message}>
          <Input id="c-email" type="email" autoComplete="email" aria-invalid={!!e.email} {...register("email")} />
        </Field>
        <Field id="c-company" label="Company" error={e.company?.message}>
          <Input id="c-company" autoComplete="organization" {...register("company")} />
        </Field>
        <Field id="c-website" label="Website" error={e.website?.message}>
          <Input id="c-website" inputMode="url" placeholder="https://yourapp.com" aria-invalid={!!e.website} {...register("website")} />
        </Field>
      </div>
      <Field id="c-service" label="Service required" error={e.service?.message}>
        <Select id="c-service" {...register("service")}>
          <option value="">Select a service…</option>
          {SERVICE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field id="c-message" label="Message" required error={e.message?.message}>
        <Textarea id="c-message" placeholder="Tell us about your application and what you'd like help with." aria-invalid={!!e.message} {...register("message")} />
      </Field>
      <Turnstile onToken={onToken} />
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      <Button type="submit" disabled={formState.isSubmitting} className="w-full sm:w-auto">
        {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send />} Request a consultation
      </Button>
      <p className="text-xs text-muted-foreground">We use these details only to respond to your request. See our privacy policy.</p>
    </form>
  );
}
