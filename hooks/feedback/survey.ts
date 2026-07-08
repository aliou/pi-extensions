import type {
  ExtensionAPI,
  ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { type CollectOptions, collectFeedback } from "./collect";
import { FeedbackOverlayComponent } from "./overlay-component";
import { buildClearRecord, buildFeedbackRecord } from "./persistence";
import { readSubagentTranscript } from "./transcript";
import {
  SUBAGENT_FEEDBACK_CUSTOM_TYPE,
  type SubagentFeedbackRecord,
} from "./types";

export interface OpenSurveyOptions {
  registerOverlay: (overlay: { dispose: () => void }) => () => void;
  onChanged?: () => void;
}

export interface SurveyDeps {
  collectOptions: (ctx: ExtensionCommandContext) => CollectOptions;
}

/**
 * Open the feedback overlay for the current session.
 *
 * Snapshot-on-open: the list reflects state at open time. After a rating is
 * submitted, the overlay updates its local item and `onChanged` is called so
 * the parent can refresh the widget.
 */
export async function openFeedbackSurvey(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  deps: SurveyDeps,
  options: OpenSurveyOptions,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("feedback requires interactive mode", "error");
    return;
  }

  const snapshot = collectFeedback(
    ctx.sessionManager.getEntries(),
    deps.collectOptions(ctx),
  );

  if (snapshot.total === 0) {
    ctx.ui.notify("No subagent runs in this branch to rate.", "info");
    return;
  }

  await ctx.ui.custom<"closed" | undefined>(
    (tui, theme: Theme, _keybindings, done) => {
      let unregister: () => void = () => undefined;
      // Guard ensures `done` runs exactly once across:
      //   - normal user close (onClose)
      //   - out-of-band session_shutdown dispose (wrapper.dispose)
      let resolved = false;
      const resolveOnce = (value: "closed"): void => {
        if (resolved) return;
        resolved = true;
        done(value);
      };

      const overlay = new FeedbackOverlayComponent({
        snapshot,
        tui,
        theme,
        readTranscript: (item) => readSubagentTranscript(item.sessionFile),
        onSubmit: (item, rating, comment) => {
          const record =
            rating === undefined
              ? buildClearRecord(item)
              : buildFeedbackRecord(item, rating, comment);
          pi.appendEntry<SubagentFeedbackRecord>(
            SUBAGENT_FEEDBACK_CUSTOM_TYPE,
            record,
          );
          options.onChanged?.();
        },
        onClose: () => {
          resolveOnce("closed");
          unregister();
        },
      });
      unregister = options.registerOverlay({
        // Shutdown may dispose the overlay out of band; resolve the
        // custom() promise so the command handler unblocks.
        dispose: () => {
          overlay.dispose();
          resolveOnce("closed");
        },
      });
      return overlay;
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "90%",
        maxHeight: "90%",
        margin: 2,
      },
    },
  );
}
