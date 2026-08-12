import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import {
  describeMissingRoster,
  getSubagentModelPreferences,
} from "@harness/subagent-models";
import {
  COMPACT_FAST_NAME,
  isSameModel,
  pickCompactFastModel,
} from "./helpers";

export default function compactFastCommand(pi: ExtensionAPI): void {
  pi.registerCommand("compact:fast", {
    description:
      "Compact the session using a fast model and restore the previous model",
    handler: async (_args, ctx) => {
      const originalModel = ctx.model;

      const preferences = await getSubagentModelPreferences(COMPACT_FAST_NAME);
      const fastModel = preferences
        ? pickCompactFastModel(ctx.modelRegistry, preferences)
        : undefined;

      if (!fastModel) {
        const reason = preferences
          ? "no configured model is available"
          : await describeMissingRoster(COMPACT_FAST_NAME);
        ctx.ui.notify(`No fast compaction model available: ${reason}`, "error");
        return;
      }

      const needsSwitch =
        !originalModel || !isSameModel(originalModel, fastModel);

      if (needsSwitch) {
        const ok = await pi.setModel(fastModel);
        if (!ok) {
          ctx.ui.notify(
            `Could not switch to ${fastModel.provider}/${fastModel.id}`,
            "error",
          );
          return;
        }
      }

      ctx.ui.notify(
        `Compacting with ${fastModel.provider}/${fastModel.id}`,
        "info",
      );

      ctx.compact({
        onComplete: () => {
          restoreModel(pi, ctx, originalModel, fastModel, "complete").catch(
            (err) => {
              ctx.ui.notify(
                `Failed to restore model: ${err instanceof Error ? err.message : String(err)}`,
                "error",
              );
            },
          );
        },
        onError: (error) => {
          ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
          restoreModel(pi, ctx, originalModel, fastModel, "error").catch(
            (err) => {
              ctx.ui.notify(
                `Failed to restore model: ${err instanceof Error ? err.message : String(err)}`,
                "error",
              );
            },
          );
        },
      });
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "compact:fast",
      description: "compact with fast model",
    });
  });
}

async function restoreModel(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  originalModel: Model<Api> | undefined,
  fastModel: Model<Api>,
  outcome: "complete" | "error",
): Promise<void> {
  const currentModel = ctx.model;

  if (currentModel && isSameModel(currentModel, fastModel)) {
    if (originalModel) {
      const ok = await pi.setModel(originalModel);
      if (ok) {
        ctx.ui.notify(
          `Compaction ${outcome}: reverted to ${originalModel.provider}/${originalModel.id}`,
          "info",
        );
      } else {
        ctx.ui.notify(
          `Compaction ${outcome}: could not revert to ${originalModel.provider}/${originalModel.id}`,
          "warning",
        );
      }
    } else {
      ctx.ui.notify(
        `Compaction ${outcome}: staying on ${fastModel.provider}/${fastModel.id} (no previous model)`,
        "info",
      );
    }
  } else {
    ctx.ui.notify(
      `Compaction ${outcome}: model changed to ${currentModel ? `${currentModel.provider}/${currentModel.id}` : "none"}, staying`,
      "info",
    );
  }
}
