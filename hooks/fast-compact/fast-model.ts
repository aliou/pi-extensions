import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// Placeholder candidate list for fast compaction. Add/remove models and order
// them by preference. The first candidate with a configured API key wins.
const FAST_MODEL_CANDIDATES: Array<{
  provider: string;
  model: string;
  thinking: ThinkingLevel;
}> = [
  { provider: "openai-codex", model: "gpt-5.3-codex-spark", thinking: "off" },
];

export function selectFastModel(
  ctx: ExtensionContext,
): { model: Model<Api>; thinking: ThinkingLevel } | undefined {
  for (const candidate of FAST_MODEL_CANDIDATES) {
    const model = ctx.modelRegistry.find(candidate.provider, candidate.model);
    if (model && ctx.modelRegistry.hasConfiguredAuth(model)) {
      return { model, thinking: candidate.thinking };
    }
  }
  return undefined;
}
