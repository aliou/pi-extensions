import type {
  MessageRenderOptions,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import type { ReviewComment, ReviewDetails, ReviewMessage } from "./types";

export function renderReviewMessage(
  message: ReviewMessage,
  _options: MessageRenderOptions,
  theme: Theme,
) {
  const details = message.details as ReviewDetails | undefined;
  const comments = details?.comments ?? [];
  const range = details?.range ?? "";
  const lines = [renderHeader(theme, comments, range)];

  for (const comment of comments) {
    const file = theme.fg("toolTitle", comment.file || "(unknown)");
    const line = comment.line > 0 ? theme.fg("dim", `:${comment.line}`) : "";
    const separator = theme.fg("dim", " ▸ ");
    lines.push(`  ${file}${line}${separator}${comment.comment}`);
  }

  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(lines.join("\n"), 0, 0));
  return box;
}

function renderHeader(
  theme: Theme,
  comments: ReviewComment[],
  range: string,
): string {
  const suffix = comments.length === 1 ? "" : "s";
  return (
    theme.fg("accent", "Review") +
    theme.fg("dim", ` (${range})`) +
    theme.fg("muted", ` — ${comments.length} comment${suffix}`)
  );
}
