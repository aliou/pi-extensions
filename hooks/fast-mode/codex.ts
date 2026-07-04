/**
 * Models eligible for Codex fast mode (OpenAI priority service tier).
 */
export type CodexRequestPayload = Record<string, unknown> & { model?: unknown };

const CODEX_PRIORITY_MODELS = new Set([
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.4-codex",
  "gpt-5.3-codex",
]);

export function isCodexSupportedModel(model: string): boolean {
  return CODEX_PRIORITY_MODELS.has(model);
}

/**
 * Returns a new provider request payload with `service_tier: "priority"`
 * injected when Codex fast mode is enabled and the selected model supports it.
 * Returns the payload unchanged otherwise.
 */
export function injectCodexServiceTier(
  payload: CodexRequestPayload,
  enabled: boolean,
): CodexRequestPayload {
  if (!enabled) return payload;

  const model = payload.model;
  if (typeof model !== "string" || !isCodexSupportedModel(model))
    return payload;
  if (Object.hasOwn(payload, "service_tier")) return payload;

  return { ...payload, service_tier: "priority" };
}
