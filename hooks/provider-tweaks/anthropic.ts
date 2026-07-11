import type { ProviderHeaders } from "@earendil-works/pi-ai";

/** Adds `X-Session-Affinity` to Anthropic provider requests. */
export function addSessionAffinityHeader(
  headers: ProviderHeaders,
  sessionId: string,
): void {
  headers["X-Session-Affinity"] = sessionId;
}
