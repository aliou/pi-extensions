import type { ProviderUsageFetchContext } from "./types";

export interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
}

export class ProviderUsageHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`Provider usage request failed: ${status} ${statusText}`);
    this.name = "ProviderUsageHttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export async function fetchJson<T>(
  url: string,
  ctx: ProviderUsageFetchContext | undefined,
  options: FetchJsonOptions = {},
): Promise<T> {
  const fetchImpl = ctx?.fetch ?? fetch;
  const signal =
    options.signal ??
    ctx?.signal ??
    timeoutSignal(options.timeoutMs ?? ctx?.timeoutMs ?? 15_000);
  const response = await fetchImpl(url, { ...options, signal });
  const text = await response.text();
  const body = parseJsonMaybe(text);
  if (!response.ok)
    throw new ProviderUsageHttpError(
      response.status,
      response.statusText,
      body,
    );
  return body as T;
}

export function parseJsonMaybe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}
