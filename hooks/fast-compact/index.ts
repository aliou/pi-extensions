import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { runCompaction } from "./run";
import type { CompactChoice } from "./types";
import { CompactModePicker } from "./ui";

const DEFAULT_CHOICE: CompactChoice = { mode: "simple", edit: false };

export default function fastCompactHook(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    if (event.signal.aborted) {
      return undefined;
    }

    let choice: CompactChoice | null | undefined;

    if (ctx.mode === "tui") {
      choice = await ctx.ui.custom(
        (tui, theme, _keybindings, done) =>
          new CompactModePicker(tui, theme, done),
      );
    }

    const resolvedChoice = choice ?? DEFAULT_CHOICE;

    try {
      const compaction = await runCompaction({
        pi,
        ctx,
        event,
        choice: resolvedChoice,
      });

      if (!compaction) {
        return undefined;
      }

      return { compaction };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`[fast-compact] compaction failed: ${message}`, "error");
      return undefined;
    }
  });
}
