import type {
  ApiStreamSimpleFunction,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

type CodexModel = Model<"openai-codex-responses">;
type CodexRequestPayload = Record<string, unknown> & { model?: unknown };

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

/**
 * Builds the stream options to pass to a downstream `streamSimple`
 * implementation.
 *
 * When Codex fast mode is enabled and the selected model supports it, the
 * returned options wrap `onPayload` so that each outgoing payload gets
 * `service_tier: "priority"` injected. When fast mode is not applicable, the
 * original options are returned unchanged.
 */
export function buildCodexStreamOptions(
  model: CodexModel,
  enabled: boolean,
  options: SimpleStreamOptions | undefined,
): SimpleStreamOptions | undefined {
  if (!enabled || !isCodexSupportedModel(model.id)) {
    return options;
  }

  const onPayload = options?.onPayload;

  return {
    ...options,
    async onPayload(payload, payloadModel) {
      const fastPayload = injectCodexServiceTier(
        payload as CodexRequestPayload,
        enabled,
      );
      if (!onPayload) return fastPayload;

      const nextPayload = await onPayload(fastPayload, payloadModel);
      return nextPayload === undefined ? fastPayload : nextPayload;
    },
  };
}

/**
 * Wraps a `streamSimple` implementation (the built-in one or one already
 * registered by another extension) so that Codex fast mode is applied on top
 * of whatever the wrapped implementation does.
 *
 * Mirrors `createAnthropicFastModeStreamSimple`: instead of importing
 * `streamSimpleAnthropic`-equivalent for codex directly and clobbering any
 * other extension's provider registration, we compose on top of whatever
 * `getApiProvider("openai-codex-responses")` currently returns.
 *
 * The previous implementation used the `before_provider_request` event. That
 * is compositionally safe today, but converting to a `streamSimple` wrapper keeps the
 * codex and anthropic fast-mode paths symmetric and means a future
 * `registerProvider("openai-codex", { streamSimple })` from another hook
 * (e.g. aperture proxy) will compose with this one rather than being
 * bypassed.
 */
export function createCodexFastModeStreamSimple(
  streamSimple: ApiStreamSimpleFunction,
  isEnabled: () => boolean,
): ApiStreamSimpleFunction {
  return (model, context, options) => {
    const streamOptions = buildCodexStreamOptions(
      model as CodexModel,
      isEnabled(),
      options,
    );
    return streamSimple(model, context, streamOptions);
  };
}
