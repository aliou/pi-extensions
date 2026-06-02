import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import type { SubagentToolCall } from "../types";
import { extractParagraphs } from "./utils";

export function renderThinking(
  running: boolean,
  content: string,
  theme: Theme,
) {
  const indicator = running
    ? theme.fg("accent", "·")
    : theme.fg("success", "✓");
  const reasoning = extractParagraphs(content, 1) || "Thinking";
  return new Markdown(`${indicator} ${reasoning}`, 0, 0, getMarkdownTheme());
}

/**
 * Render a single subagent tool-call line: status indicator + action label +
 * optional detail text. Use this from a tool's `render` to keep it a one-liner
 * and consistent across subagents.
 */
export function renderSubagentToolLine(
  toolCall: SubagentToolCall,
  theme: Theme,
  action: string,
  details = "",
) {
  return new Text(
    [
      formatToolCallIndicator(toolCall, theme),
      theme.fg("toolTitle", action),
      details ? theme.fg("thinkingMinimal", details) : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    0,
    0,
  );
}

export function renderToolCall(toolCall: SubagentToolCall, theme: Theme) {
  const indicator = formatToolCallIndicator(toolCall, theme);
  return new Text(
    `${indicator} ${theme.fg("toolTitle", toolCall.toolName)} ${theme.fg(
      "toolOutput",
      formatArgs(toolCall.args),
    )}`,
    0,
    0,
  );
}

function formatToolCallIndicator(toolCall: SubagentToolCall, theme: Theme) {
  switch (toolCall.status) {
    case "running":
      return theme.fg("accent", "·");
    case "success":
      return theme.fg("success", "✓");
    case "error":
      return theme.fg("error", "✗");
  }
}

function formatArgs(args: Record<string, unknown>) {
  try {
    return JSON.stringify(args);
  } catch (_error) {
    void _error;
    return "[unserializable args]";
  }
}
