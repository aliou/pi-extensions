import type { ProviderHeaders } from "@earendil-works/pi-ai";

type AnthropicRequestPayload = Record<string, unknown> & { model?: unknown };

/**
 * Anthropic beta header that opts requests into fast mode.
 */
const FAST_MODE_BETA = "fast-mode-2026-02-01";

/**
 * Beta headers required when authenticating with a Claude Code OAuth token.
 */
const CLAUDE_CODE_BETAS = ["claude-code-20250219", "oauth-2025-04-20"];

/**
 * Models eligible for Anthropic fast mode.
 *
 * Override at runtime by setting the `ANTHROPIC_FAST_MODELS` environment
 * variable to a comma-separated list of model IDs.
 */
export const ANTHROPIC_FAST_MODELS = process.env.ANTHROPIC_FAST_MODELS
  ? new Set(process.env.ANTHROPIC_FAST_MODELS.split(","))
  : new Set(["claude-opus-4-8", "claude-opus-4-7"]);

export function isAnthropicSupportedModel(model: string): boolean {
  return ANTHROPIC_FAST_MODELS.has(model);
}

export function getHeader(
  headers: ProviderHeaders | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  const value = key ? headers[key] : undefined;
  return value === null ? undefined : value;
}

export function appendBetas(...values: Array<string | undefined>): string {
  const betas = new Set<string>();
  for (const value of values) {
    for (const beta of value?.split(",") ?? []) {
      const trimmed = beta.trim();
      if (trimmed) betas.add(trimmed);
    }
  }
  betas.add(FAST_MODE_BETA);
  return [...betas].join(",");
}

export function addAnthropicFastModeHeader(
  headers: ProviderHeaders,
  usesOAuth: boolean,
): void {
  const incoming = getHeader(headers, "anthropic-beta");
  const base = usesOAuth ? CLAUDE_CODE_BETAS.join(",") : undefined;
  headers["anthropic-beta"] = appendBetas(base, incoming);
}

/**
 * Returns a new request payload with `speed: "fast"` injected when the selected
 * model supports Anthropic fast mode and the caller hasn't already set `speed`.
 * Returns the payload unchanged otherwise.
 */
export function addAnthropicFastModePayload(
  payload: AnthropicRequestPayload,
): AnthropicRequestPayload {
  const model = payload.model;
  if (typeof model !== "string" || !isAnthropicSupportedModel(model))
    return payload;
  if (Object.hasOwn(payload, "speed")) return payload;

  return { ...payload, speed: "fast" };
}
