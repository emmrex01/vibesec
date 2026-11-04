import { serverEnv } from "@/config/env";

/** Verifies a Cloudflare Turnstile token. When no secret is configured, verification is skipped (dev). */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = serverEnv().turnstileSecretKey;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
