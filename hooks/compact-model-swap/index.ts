import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registry } from "@harness/model-registry";

export default function compactModelSwap(pi: ExtensionAPI): void {
  let sessionModel: Model<Api> | undefined;
  let sessionThinkingLevel: ThinkingLevel | undefined;
  let wasDefaultCompaction = false;

  pi.on("session_before_compact", async (event, ctx) => {
    wasDefaultCompaction = false;

    if (event.customInstructions?.trim() === "default") {
      wasDefaultCompaction = true;
      return undefined;
    }

    const compactionModelCandidates = registry.get(
      "ad:small:text",
      ctx.modelRegistry,
    );

    for (const { provider, model, thinking } of compactionModelCandidates) {
      const compactionModel = ctx.modelRegistry.find(provider, model);
      if (!compactionModel) continue;

      const currentModel = ctx.model;
      const currentThinkingLevel = ctx.model
        ? pi.getThinkingLevel()
        : undefined;

      const set = await pi.setModel(compactionModel);
      if (!set) {
        continue;
      }
      pi.setThinkingLevel(thinking);

      sessionModel = currentModel;
      sessionThinkingLevel = currentThinkingLevel;

      ctx.ui.notify(
        `[compact] Swapped to model ${provider}/${model}:${thinking}`,
        "info",
      );

      // Explicitly return undefined to fallback to default compaction setup.
      return undefined;
    }
  });

  pi.on("session_compact", async (_event, _ctx) => {
    if (wasDefaultCompaction) {
      return;
    }
    if (sessionModel) {
      await pi.setModel(sessionModel);
    }

    if (sessionThinkingLevel) {
      pi.setThinkingLevel(sessionThinkingLevel);
    }

    sessionModel = undefined;
    sessionThinkingLevel = undefined;
  });
}
