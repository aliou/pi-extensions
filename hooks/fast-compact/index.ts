import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { fastCompact } from "./compaction";
import { createSummarizationSubagent } from "./subagent";

export default function fastCompactHook(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    if (event.signal.aborted) {
      return undefined;
    }

    const model = ctx.model;
    if (!model) {
      return undefined;
    }

    const subagent = createSummarizationSubagent(
      pi,
      model,
      pi.getThinkingLevel(),
    );

    const summarize = async (prompt: string) => {
      const result = await subagent.runWithParams(
        { prompt },
        { callId: "fast-compact", ctx, signal: event.signal },
      );

      if (result.details.status === "error" || result.details.error) {
        throw new Error(
          result.details.error ?? "Subagent summarization failed",
        );
      }

      const response = result.details.response;
      if (response === undefined || response === "") {
        throw new Error("Subagent returned empty summary");
      }

      return response;
    };

    try {
      const compaction = await fastCompact(
        event.preparation,
        event.customInstructions,
        summarize,
      );

      return { compaction };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`[fast-compact] compaction failed: ${message}`, "error");
      return undefined;
    }
  });
}
