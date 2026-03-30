import { getMarkdownTheme, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import type { SubagentToolCall, SubagentUsage } from "@subagents/lib/types";
import { INDICATOR } from "@subagents/lib/ui/spinner";
import { formatSubagentStats, pluralize } from "@subagents/lib/ui/stats";
import {
  formatToolCallExpanded,
  getCurrentRunningTool,
} from "@subagents/lib/ui/tool-formatters";

/**
 * Model reference for display.
 */
export interface ModelRef {
  provider: string;
  model: string;
}

/**
 * Render subagent call header.
 *
 * Format: "Label (provider/model)"
 * Followed by primary input lines.
 */
export function renderSubagentCallHeader(
  label: string,
  modelRef: ModelRef,
  primaryLines: Array<{ label: string; value: string }>,
  theme: Theme,
): Container {
  const container = new Container();

  // Title line: Label (provider/model)
  const titleText = `${theme.fg("toolTitle", theme.bold(label))} ${theme.fg(
    "muted",
    `(${modelRef.provider}/${modelRef.model})`,
  )}`;
  container.addChild(new Text(titleText, 0, 0));

  // Primary input lines
  for (const line of primaryLines) {
    const lineText = `  ${theme.fg("muted", `${line.label}:`)} ${theme.fg(
      "accent",
      line.value,
    )}`;
    container.addChild(new Text(lineText, 0, 0));
  }

  return container;
}

/**
 * Render streaming status (current tool + counts).
 */
export function renderStreamingStatus(
  toolCalls: SubagentToolCall[],
  theme: Theme,
): Container | Text {
  const currentTool = getCurrentRunningTool(toolCalls);

  if (!currentTool) {
    // No tools yet, just show thinking
    return new Text(`  thinking...`, 0, 0);
  }

  const container = new Container();

  // Show current tool
  const toolLine = formatToolCallExpanded(currentTool, theme);
  container.addChild(new Text(toolLine, 0, 0));

  // Show counts if multiple tools
  if (toolCalls.length > 1) {
    const done = toolCalls.filter((t) => t.status !== "running").length;
    const running = toolCalls.filter((t) => t.status === "running").length;
    const countText = theme.fg("muted", `  (${done} done, ${running} running)`);
    container.addChild(new Text(countText, 0, 0));
  }

  return container;
}

/**
 * Render done result.
 *
 * Collapsed: "check stats"
 * Expanded: stats + tool summary + markdown response + footer
 */
export function renderDoneResult(
  response: string,
  toolCalls: SubagentToolCall[],
  usage: SubagentUsage,
  expanded: boolean,
  theme: Theme,
): Container | Text {
  const stats = formatSubagentStats(usage, toolCalls.length);

  if (!expanded) {
    // Collapsed view: just show stats
    return new Text(`${INDICATOR.done} ${theme.fg("muted", stats)}`, 0, 0);
  }

  // Expanded view
  const container = new Container();

  // Stats line
  container.addChild(
    new Text(`${INDICATOR.done} ${theme.fg("muted", stats)}`, 0, 0),
  );

  // Tool summary if any
  if (toolCalls.length > 0) {
    const errors = toolCalls.filter((t) => t.status === "error").length;
    const toolSummary =
      errors > 0
        ? `${toolCalls.length} ${pluralize(toolCalls.length, "tool call")}, ${errors} ${pluralize(errors, "error")}`
        : `${toolCalls.length} ${pluralize(toolCalls.length, "tool call")}`;
    container.addChild(new Text(theme.fg("muted", toolSummary), 0, 0));
  }

  // Response content
  if (response.trim()) {
    try {
      const mdTheme = getMarkdownTheme();
      const md = new Markdown(response, 0, 0, mdTheme);
      container.addChild(md);
    } catch {
      // Fallback to plain text if markdown fails
      container.addChild(new Text(response, 0, 0));
    }
  }

  return container;
}
