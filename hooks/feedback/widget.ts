import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { FeedbackSnapshot } from "./types";

export const FEEDBACK_WIDGET_ID = "feedback";

/**
 * Render the single widget line: `feedback: <unrated> pending`, right-aligned.
 *
 * Padding is applied to the plain (unstyled) string BEFORE the theme color is
 * applied, because ANSI escape codes break naive `padStart`/`visibleWidth`.
 */
export function renderFeedbackLine(
  snapshot: FeedbackSnapshot,
  width: number,
  theme: Theme,
): string[] {
  const label = `feedback: ${snapshot.unrated} pending`;
  const pad = Math.max(0, width - label.length);
  const styled = theme.fg("muted", `${" ".repeat(pad)}${label}`);
  return [
    visibleWidth(styled) > width ? truncateToWidth(styled, width, "") : styled,
  ];
}

/**
 * Show or hide the feedback widget based on the snapshot.
 *
 * Hidden when there are no subagent runs, or when nothing is left to rate.
 */
export function setFeedbackWidget(
  ctx: ExtensionContext,
  snapshot: FeedbackSnapshot,
): void {
  if (!ctx.hasUI) return;
  if (snapshot.total === 0 || snapshot.unrated === 0) {
    clearFeedbackWidget(ctx);
    return;
  }

  ctx.ui.setWidget(FEEDBACK_WIDGET_ID, (_tui, theme) => ({
    render: (width: number) => renderFeedbackLine(snapshot, width, theme),
    invalidate(): void {},
  }));
}

export function clearFeedbackWidget(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget(FEEDBACK_WIDGET_ID, undefined);
}
