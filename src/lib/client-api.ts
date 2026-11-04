export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export async function postJson<T = unknown>(url: string, body: unknown, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "POST",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? { code: "network", message: "Something went wrong. Please try again." } };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: { code: "network", message: "Network error. Please check your connection and try again." } };
  }
}
