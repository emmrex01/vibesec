"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { COUNTRIES } from "@/config/countries";
import { postJson } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  APP_TYPES,
  assessmentSubmissionSchema,
  AUTHORIZATION_TEXT,
  MARKETING_TEXT,
  PLATFORMS,
} from "@/lib/validation/schemas";
import { Turnstile, turnstileEnabled } from "./turnstile";

const formSchema = assessmentSubmissionSchema.omit({ idempotencyKey: true, turnstileToken: true });
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

const STEPS: { title: string; fields: FieldPath<FormIn>[] }[] = [
  { title: "Website", fields: ["websiteUrl", "websiteName", "platform"] },
  { title: "Contact", fields: ["fullName", "email", "company", "jobTitle", "country", "companyWebsite"] },
  { title: "Application", fields: ["appType", "hasRegistration", "hasLogin", "processesPayments", "storesCustomerData", "usesDatabase", "hasAdminDashboard", "wantsRemediationHelp"] },
  { title: "Authorization", fields: ["authorizationConfirmed", "marketingConsent"] },
  { title: "Review", fields: [] },
];

const QUESTIONS: { name: FieldPath<FormIn>; label: string }[] = [
  { name: "hasRegistration", label: "Does the application have user registration?" },
  { name: "hasLogin", label: "Does it have login functionality?" },
  { name: "processesPayments", label: "Does it process payments?" },
  { name: "storesCustomerData", label: "Does it store customer information?" },
  { name: "usesDatabase", label: "Does it use a database?" },
  { name: "hasAdminDashboard", label: "Does it have an administrative dashboard?" },
];

function newKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function AssessmentForm({ initialUrl = "", compact = false }: { initialUrl?: string; compact?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // One key per form instance makes retries and double-clicks idempotent server-side.
  const idempotencyKey = useMemo(() => newKey(), []);
  const onToken = useCallback((t: string | null) => setTurnstileToken(t), []);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      websiteUrl: initialUrl,
      websiteName: "",
      fullName: "",
      email: "",
      company: "",
      jobTitle: "",
      country: "",
      companyWebsite: "",
      marketingConsent: false,
      wantsRemediationHelp: false,
      company_fax: "",
    },
  });
  const { register, formState, trigger, handleSubmit, getValues, setError } = form;
  const errors = formState.errors;

  const next = async () => {
    const valid = await trigger(STEPS[step].fields, { shouldFocus: true });
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = async (values: FormOut) => {
    if (submitting) return;
    if (turnstileEnabled() && !turnstileToken) {
      setServerError("Please complete the bot protection check.");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    const res = await postJson<{ reportPath: string }>("/api/assessment/submit", { ...values, idempotencyKey, turnstileToken: turnstileToken ?? undefined });
    if (res.ok) {
      router.push(res.data.reportPath);
      return;
    }
    setSubmitting(false);
    setServerError(res.error.message);
    if (res.error.fields) {
      let firstStep = STEPS.length - 1;
      for (const [field, message] of Object.entries(res.error.fields)) {
        setError(field as FieldPath<FormIn>, { message });
        const idx = STEPS.findIndex((s) => s.fields.includes(field as FieldPath<FormIn>));
        if (idx >= 0) firstStep = Math.min(firstStep, idx);
      }
      setStep(firstStep);
    }
  };

  const err = (name: FieldPath<FormIn>) => {
    const e = name.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;
    return e?.message;
  };
  const aria = (name: FieldPath<FormIn>) => ({ "aria-invalid": !!err(name), "aria-describedby": err(name) ? `${name}-error` : undefined });
  const v = getValues();

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn("space-y-6", compact && "space-y-5")} aria-label="Free security assessment request">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length} · <span className="text-foreground">{STEPS[step].title}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden /> Passive, non-intrusive checks only
          </span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} label="Form progress" />
      </div>

      {/* Honeypot (hidden from people and assistive tech) */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_fax">Company fax</label>
        <input id="company_fax" tabIndex={-1} autoComplete="off" {...register("company_fax")} />
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Field id="websiteUrl" label="Website URL" required error={err("websiteUrl")} hint="We assess the public homepage only, e.g. https://yourapp.com">
            <Input id="websiteUrl" inputMode="url" autoComplete="url" placeholder="https://yourapp.com" {...register("websiteUrl")} {...aria("websiteUrl")} />
          </Field>
          <Field id="websiteName" label="Website name" error={err("websiteName")}>
            <Input id="websiteName" placeholder="Acme Dashboard" {...register("websiteName")} {...aria("websiteName")} />
          </Field>
          <Field id="platform" label="Website platform" error={err("platform")}>
            <Select id="platform" defaultValue="" {...register("platform")}>
              <option value="">Select a platform…</option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fullName" label="Full name" required error={err("fullName")}>
            <Input id="fullName" autoComplete="name" {...register("fullName")} {...aria("fullName")} />
          </Field>
          <Field id="email" label="Business email" required error={err("email")}>
            <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} {...aria("email")} />
          </Field>
          <Field id="company" label="Company name" required error={err("company")}>
            <Input id="company" autoComplete="organization" {...register("company")} {...aria("company")} />
          </Field>
          <Field id="jobTitle" label="Job title" error={err("jobTitle")}>
            <Input id="jobTitle" autoComplete="organization-title" {...register("jobTitle")} {...aria("jobTitle")} />
          </Field>
          <Field id="country" label="Country" required error={err("country")}>
            <Select id="country" defaultValue="" autoComplete="country-name" {...register("country")} {...aria("country")}>
              <option value="">Select your country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field id="companyWebsite" label="Company website (if different)" error={err("companyWebsite")}>
            <Input id="companyWebsite" inputMode="url" placeholder="https://company.com" {...register("companyWebsite")} {...aria("companyWebsite")} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Optional context that helps us interpret the results. Your answers are not treated as verified technical facts.</p>
          <Field id="appType" label="Is this a business website or application?" error={err("appType")}>
            <Select id="appType" defaultValue="" {...register("appType")}>
              <option value="">Select…</option>
              {APP_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUESTIONS.map((q) => (
              <fieldset key={q.name} className="rounded-lg border p-3">
                <legend className="px-1 text-sm">{q.label}</legend>
                <div className="mt-1 flex gap-4 text-sm">
                  {(["yes", "no", "unsure"] as const).map((opt) => (
                    <label key={opt} className="inline-flex cursor-pointer items-center gap-1.5 capitalize text-muted-foreground has-[:checked]:text-foreground">
                      <input type="radio" value={opt} className="accent-[hsl(var(--primary))]" {...register(q.name)} />
                      {opt === "unsure" ? "Not sure" : opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox {...register("wantsRemediationHelp")} />
            <span>I&apos;d like VibeSec to contact me about help fixing any findings.</span>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <label className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", err("authorizationConfirmed") && "border-destructive/60")}>
            <Checkbox {...register("authorizationConfirmed")} {...aria("authorizationConfirmed")} />
            <span>
              {AUTHORIZATION_TEXT} <span className="text-cyan-400">*</span>
            </span>
          </label>
          {err("authorizationConfirmed") && (
            <p id="authorizationConfirmed-error" className="text-xs text-red-300" role="alert">{err("authorizationConfirmed")}</p>
          )}
          <div className="rounded-lg border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Privacy notice</p>
            We use your contact details and the assessment results to perform the assessment you request, deliver your report and respond to you. We
            store a salted hash of your IP address for abuse prevention, never sell your data, and you can ask us to delete it at any time. Read the{" "}
            <Link href="/privacy" className="text-cyan-400 hover:underline" target="_blank">privacy policy</Link> and{" "}
            <Link href="/disclaimer" className="text-cyan-400 hover:underline" target="_blank">assessment disclaimer</Link>.
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
            <Checkbox {...register("marketingConsent")} />
            <span>
              {MARKETING_TEXT} <span className="text-muted-foreground">(optional — not required for your assessment)</span>
            </span>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Website</dt><dd className="break-all font-medium">{v.websiteUrl}</dd></div>
            <div><dt className="text-muted-foreground">Platform</dt><dd className="font-medium">{PLATFORMS.find((p) => p.value === v.platform)?.label ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{v.fullName}</dd></div>
            <div><dt className="text-muted-foreground">Email</dt><dd className="break-all font-medium">{v.email}</dd></div>
            <div><dt className="text-muted-foreground">Company</dt><dd className="font-medium">{v.company}</dd></div>
            <div><dt className="text-muted-foreground">Country</dt><dd className="font-medium">{v.country}</dd></div>
          </dl>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden />
            We&apos;ll make a small number of standard requests to your public homepage and DNS. Nothing is submitted, crawled or attacked.
          </div>
          <Turnstile onToken={onToken} />
        </div>
      )}

      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Check />}
            {submitting ? "Starting assessment…" : "Start Free Security Assessment"}
          </Button>
        )}
      </div>
    </form>
  );
}
