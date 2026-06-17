import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  buildProjectionHints,
  CachedModelUsage,
  ModelBroker,
  readUsageCache,
} from "@harness/models";

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

    const cache = await readUsageCache().catch(() => null);
    const projections = cache
      ? await buildProjectionHints(cache.snapshots).catch(() => new Map())
      : new Map();
    const models = new ModelBroker({
      registry: ctx.modelRegistry,
      usage: cache
        ? new CachedModelUsage({
            snapshots: cache.snapshots,
            projections,
            fresh: cache.fresh,
          })
        : undefined,
    });

    for (const choice of models.roster("ad:utility:text")) {
      const compactionModel = choice.model;
      const { provider, model, thinking } = choice.preference;

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

      for (const skipped of choice.skipped) {
        ctx.ui.notify(
          `[model] skipped ${skipped.preference.provider}/${skipped.preference.model}: ${skipped.detail ?? skipped.reason}`,
          "warning",
        );
      }

      ctx.ui.notify(`Compacting with ${provider}/${model}:${thinking}`, "info");

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
