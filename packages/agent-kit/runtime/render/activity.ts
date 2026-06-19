import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import { formatDisplayPath } from "@harness/utils";
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

export function renderToolCall(
  toolCall: SubagentToolCall,
  theme: Theme,
  cwd: string,
) {
  const indicator = formatToolCallIndicator(toolCall, theme);
  const argsText = formatArgs(toolCall.args);
  const cwdSuffix = formatCwdSuffix(toolCall.args.cwd, cwd, theme);
  const parts = [
    indicator,
    theme.fg("toolTitle", toolCall.toolName),
    argsText ? theme.fg("toolOutput", argsText) : undefined,
    cwdSuffix,
  ].filter((part): part is string => Boolean(part));
  return new Text(parts.join(" "), 0, 0);
}

function formatCwdSuffix(
  cwdArg: unknown,
  cwd: string,
  theme: Theme,
): string | undefined {
  if (!cwdArg || typeof cwdArg !== "string") return undefined;
  return theme.fg("muted", `(cwd: ${formatDisplayPath(cwdArg, cwd)})`);
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
  const displayArgs = { ...args };
  delete displayArgs.cwd;
  if (Object.keys(displayArgs).length === 0) return "";
  try {
    return JSON.stringify(displayArgs);
  } catch (_error) {
    void _error;
    return "[unserializable args]";
  }
}
