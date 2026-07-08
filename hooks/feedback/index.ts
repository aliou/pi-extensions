import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import { type CollectOptions, collectFeedback } from "./collect";
import { openFeedbackSurvey } from "./survey";
import { clearFeedbackWidget, setFeedbackWidget } from "./widget";

export default function feedback(pi: ExtensionAPI): void {
  const openOverlays = new Set<{ dispose: () => void }>();

  const refreshWidget = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return;
    const snapshot = collectFeedback(
      ctx.sessionManager.getEntries(),
      collectOptionsFor(ctx),
    );
    setFeedbackWidget(ctx, snapshot);
  };

  const collectOptionsFor = (ctx: ExtensionContext): CollectOptions => ({
    currentSessionId: ctx.sessionManager.getSessionId(),
    leafId: ctx.sessionManager.getLeafId() ?? undefined,
  });

  const onRefresh = (_event: unknown, ctx: ExtensionContext): void => {
    refreshWidget(ctx);
  };

  pi.on("tool_result", onRefresh);
  pi.on("turn_end", onRefresh);
  pi.on("session_start", onRefresh);
  pi.on("session_tree", onRefresh);

  const onShutdown = (_event: unknown, ctx?: ExtensionContext): void => {
    if (ctx?.hasUI) clearFeedbackWidget(ctx);
    for (const overlay of [...openOverlays]) overlay.dispose();
    openOverlays.clear();
  };

  pi.on("session_shutdown", onShutdown);

  pi.registerCommand("feedback", {
    description: "Rate recent subagent runs.",
    handler: async (_args: string, ctx) => {
      await openFeedbackSurvey(
        pi,
        ctx,
        {
          collectOptions: collectOptionsFor,
        },
        {
          registerOverlay: (overlay) => {
            openOverlays.add(overlay);
            return () => openOverlays.delete(overlay);
          },
          onChanged: () => refreshWidget(ctx),
        },
      );
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "feedback",
      description: "rate subagent runs",
    });
  });
}
