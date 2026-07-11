import type { SimpleStreamOptions } from "@earendil-works/pi-ai";
import {
  type ApiStreamSimpleFunction,
  getApiProvider,
} from "@earendil-works/pi-ai/compat";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";
import type { Optional } from "@harness/utils";

type ReasoningSummary = "auto" | "concise" | "detailed" | "off" | "on";

interface CodexReasoning {
  effort?: string;
  summary?: ReasoningSummary | null;
}

interface CodexResponsesPayload {
  model?: unknown;
  reasoning?: CodexReasoning;
  [key: string]: unknown;
}

const GPT_56_MODELS = new Set([
  "gpt-5.6",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
]);

export function injectDetailedReasoningSummary(
  payload: CodexResponsesPayload,
): CodexResponsesPayload {
  if (
    typeof payload.model !== "string" ||
    !GPT_56_MODELS.has(payload.model) ||
    !payload.reasoning
  ) {
    return payload;
  }

  return {
    ...payload,
    reasoning: {
      ...payload.reasoning,
      summary: "detailed",
    },
  };
}

function withDetailedReasoningSummary(
  options: SimpleStreamOptions | undefined,
): SimpleStreamOptions | undefined {
  const onPayload = options?.onPayload;

  return {
    ...options,
    async onPayload(payload, model) {
      const detailedPayload = injectDetailedReasoningSummary(
        payload as CodexResponsesPayload,
      );
      if (!onPayload) return detailedPayload;

      const nextPayload = await onPayload(detailedPayload, model);
      return nextPayload ?? detailedPayload;
    },
  };
}

function createOpenAICodexStreamSimple(
  streamSimple: ApiStreamSimpleFunction,
): ApiStreamSimpleFunction {
  return (model, context, options) => {
    return streamSimple(model, context, withDetailedReasoningSummary(options));
  };
}

/** Sets detailed reasoning summaries for GPT-5.6 Codex Responses requests. */
export function getOpenAICodexProvider(): Optional<ProviderConfig> {
  const builtIn = getApiProvider("openai-codex-responses");
  if (!builtIn?.streamSimple) return;

  return {
    api: "openai-codex-responses",
    streamSimple: createOpenAICodexStreamSimple(builtIn.streamSimple),
  };
}
