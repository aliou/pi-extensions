import type { streamSimpleAnthropic } from "@earendil-works/pi-ai";

type AnthropicModel = Parameters<typeof streamSimpleAnthropic>[0];
type AnthropicStreamOptions = Parameters<typeof streamSimpleAnthropic>[2];
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

export function isOAuthToken(apiKey: string | undefined): boolean {
  return apiKey?.includes("sk-ant-oat") === true;
}

export function getHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key ? headers[key] : undefined;
}

export function withoutHeader(
  headers: Record<string, string> | undefined,
  name: string,
): Record<string, string> {
  if (!headers) return {};
  const lower = name.toLowerCase();
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => k.toLowerCase() !== lower),
  );
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

/**
 * Builds the stream options to pass to `streamSimpleAnthropic`.
 *
 * When Anthropic fast mode is enabled and the selected model supports it, the
 * returned options carry the `fast-mode` beta header and wrap `onPayload` so
 * that each outgoing payload gets `speed: "fast"` injected. When fast mode is
 * not applicable, the original options are returned unchanged.
 */
export function buildAnthropicStreamOptions(
  model: AnthropicModel,
  enabled: boolean,
  options: AnthropicStreamOptions | undefined,
): AnthropicStreamOptions | undefined {
  if (!enabled || !isAnthropicSupportedModel(model.id)) {
    return options;
  }

  const incoming = getHeader(options?.headers, "anthropic-beta");
  const base = isOAuthToken(options?.apiKey)
    ? CLAUDE_CODE_BETAS.join(",")
    : undefined;
  const headers = {
    ...withoutHeader(options?.headers, "anthropic-beta"),
    "anthropic-beta": appendBetas(base, incoming),
  };

  const onPayload = options?.onPayload;

  return {
    ...options,
    headers,
    async onPayload(payload, payloadModel) {
      const fastPayload = addAnthropicFastModePayload(
        payload as AnthropicRequestPayload,
      );
      if (!onPayload) return fastPayload;

      const nextPayload = await onPayload(fastPayload, payloadModel);
      return nextPayload === undefined ? fastPayload : nextPayload;
    },
  };
}
