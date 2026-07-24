import type { ProviderHeaders } from "@earendil-works/pi-ai";

/**
 * Aperture session-provenance header. Aperture groups requests by this
 * header; without it each request becomes its own `xrnd_*` session.
 *
 * `pi-ts-aperture` sets it in parent sessions via `before_provider_headers`.
 * Subagents do not load that extension, so `provider-tweaks` fills the gap
 * using the same `ctx.sessionManager.getSessionId()` source. Set only when
 * absent (case-insensitive) so Aperture stays authoritative in parents.
 */
export const SESSION_ID_HEADER = "x-session-id";

function hasHeader(headers: ProviderHeaders, name: string): boolean {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return true;
  }
  return false;
}

export function addSessionIdHeader(
  headers: ProviderHeaders,
  sessionId: string | undefined,
): void {
  if (!sessionId) return;
  if (hasHeader(headers, SESSION_ID_HEADER)) return;
  headers[SESSION_ID_HEADER] = sessionId;
}
