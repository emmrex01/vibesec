"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client-api";
import { deletionRequestSchema } from "@/lib/validation/schemas";
import { Turnstile, turnstileEnabled } from "./turnstile";

const schema = deletionRequestSchema.omit({ turnstileToken: true });

export function DeletionRequestForm() {
  const [done, setDone] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);
  const { register, handleSubmit, formState } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", website: "", message: "", company_fax: "" },
  });

  if (done) return <Alert variant="success">Your deletion request has been received. We will confirm by email once it has been processed.</Alert>;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        if (turnstileEnabled() && !token) return setErr("Please complete the bot protection check.");
        const res = await postJson("/api/data-deletion", { ...values, turnstileToken: token ?? undefined });
        if (res.ok) setDone(true);
        else setErr(res.error.message);
      })}
    >
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input tabIndex={-1} autoComplete="off" {...register("company_fax")} />
      </div>
      <Field id="d-email" label="Email address used for the assessment" required error={formState.errors.email?.message}>
        <Input id="d-email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field id="d-website" label="Website assessed" error={formState.errors.website?.message}>
        <Input id="d-website" inputMode="url" {...register("website")} />
      </Field>
      <Field id="d-message" label="Anything else we should know" error={formState.errors.message?.message}>
        <Textarea id="d-message" {...register("message")} />
      </Field>
      <Turnstile onToken={onToken} />
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" variant="secondary" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="animate-spin" />} Request deletion
      </Button>
    </form>
  );
}
