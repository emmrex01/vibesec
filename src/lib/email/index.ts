import { serverEnv } from "@/config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<boolean>;
}

export const noopMailer: Mailer = { send: async () => false };

/** Resend via its HTTPS API (no SDK dependency). Silently disabled when RESEND_API_KEY is unset. */
export function createMailer(fromOverride?: { name?: string | null; address?: string | null }): Mailer {
  const env = serverEnv();
  const address = fromOverride?.address || env.emailFrom;
  if (!env.resendApiKey || !address) return noopMailer;
  const from = fromOverride?.name ? `${fromOverride.name} <${address}>` : address;
  return {
    async send(message) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) console.error(`[email] Resend responded ${res.status}`);
        return res.ok;
      } catch {
        console.error("[email] send failed");
        return false;
      }
    },
  };
}
