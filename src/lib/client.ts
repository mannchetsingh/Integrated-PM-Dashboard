"use client";

/**
 * Thin fetch wrapper for the /api routes. Every route answers with JSON and
 * puts failures in an `error` field, so unwrapping that once here keeps the
 * call sites free of response plumbing.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { error?: string }) => body?.error)
      .catch(() => null);
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url, { cache: "no-store" }),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T = { ok: true }>(url: string) => request<T>(url, { method: "DELETE" }),
};

/**
 * Reads a text/plain streaming route (/api/chat, /api/write) chunk by chunk.
 * `onChunk` receives each delta; the full text is returned at the end.
 *
 * Pass an AbortSignal to let the user stop a long generation — an abort
 * resolves with whatever had already arrived rather than throwing.
 */
export async function streamText(
  url: string,
  body: unknown,
  onChunk: (delta: string, soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((parsed: { error?: string }) => parsed?.error)
      .catch(() => null);
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }
  if (!response.body) throw new ApiError("The server sent an empty response.", 500);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const delta = decoder.decode(value, { stream: true });
      if (!delta) continue;
      full += delta;
      onChunk(delta, full);
    }
  } catch (error) {
    // An abort is a user action, not a failure — hand back the partial text.
    if ((error as Error)?.name !== "AbortError") throw error;
  }

  return full;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
