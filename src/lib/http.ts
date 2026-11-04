import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "@/lib/services/assessment-service";

export const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorJson(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, error: { code, message, ...extra } }, status);
}

/** Maps any thrown error to a safe public response. Internal details are logged, never returned. */
export function handleError(e: unknown, context: string) {
  if (e instanceof ServiceError) return errorJson(e.status, e.code, e.publicMessage);
  if (e instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return errorJson(400, "validation_error", "Please check the highlighted fields.", { fields });
  }
  console.error(`[${context}] unexpected error`, e instanceof Error ? e.name + ": " + e.message.slice(0, 200) : "unknown");
  return errorJson(500, "internal_error", "Something went wrong on our side. Please try again shortly.");
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64) || null;
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? null;
}

const MAX_BODY_BYTES = 32_768;

/** Parses a JSON body with a size cap. */
export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new ServiceError(415, "unsupported_media_type", "Expected a JSON request body.");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ServiceError(413, "payload_too_large", "Request body too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError(400, "invalid_json", "Malformed JSON body.");
  }
}

/** Same-origin check for state-changing requests (CSRF defence for cookie-authenticated routes). */
export function isSameOrigin(req: Request, siteUrl: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    return o.host === self.host || o.host === new URL(siteUrl).host;
  } catch {
    return false;
  }
}
