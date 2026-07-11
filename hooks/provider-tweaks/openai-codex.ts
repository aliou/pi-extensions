type ReasoningSummary = "auto" | "concise" | "detailed" | "off" | "on";

interface CodexReasoning {
  effort?: string;
  summary?: ReasoningSummary | null;
}

export interface CodexResponsesPayload {
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
