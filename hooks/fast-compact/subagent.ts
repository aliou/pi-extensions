import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { Type } from "typebox";

import { SUMMARIZATION_SYSTEM_PROMPT } from "./prompts";

const SummarizeParams = Type.Object({
  prompt: Type.String(),
});

export function createSummarizationSubagent(
  pi: ExtensionAPI,
  model: Model<Api>,
  thinkingLevel: ThinkingLevel,
) {
  return createSubagent(pi, {
    name: "fast-compact",
    label: "Fast Compact",
    description: "Summarize conversation context for compaction",
    systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
    tools: [],
    parameters: SummarizeParams,
    modelPreferences: [
      {
        provider: model.provider,
        model: model.id,
        thinking: thinkingLevel,
      },
    ],
    session: { inheritSessionId: false },
    buildPrompt: (params) => ({ text: params.prompt }),
  });
}
