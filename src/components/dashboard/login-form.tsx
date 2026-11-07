"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm({ configured, denied }: { configured: boolean; denied: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(denied ? "This account does not have administrator access." : null);
  const [busy, setBusy] = useState(false);

  if (!configured) return <Alert variant="destructive">Supabase is not configured. Set the environment variables described in the README.</Alert>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const supabase = createBrowserSupabase();
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) {
          setBusy(false);
          setError("Invalid email or password.");
          return;
        }
        router.replace("/admin/dashboard");
        router.refresh();
      }}
    >
      <Field id="email" label="Email" required>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field id="password" label="Password" required>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
      </Button>
    </form>
  );
}
