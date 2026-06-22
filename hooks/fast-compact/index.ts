import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { fastCompact } from "./compaction";

export default function fastCompactHook(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    if (event.signal.aborted) {
      return undefined;
    }

    const model = ctx.model;
    if (!model) {
      return undefined;
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) {
      ctx.ui.notify(
        `[fast-compact] auth unavailable: ${auth.error}`,
        "warning",
      );
      return undefined;
    }

    try {
      const compaction = await fastCompact(
        event.preparation,
        model,
        auth.apiKey,
        auth.headers,
        auth.env,
        event.customInstructions,
        event.signal,
        pi.getThinkingLevel(),
      );

      return { compaction };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`[fast-compact] compaction failed: ${message}`, "error");
      return undefined;
    }
  });
}
