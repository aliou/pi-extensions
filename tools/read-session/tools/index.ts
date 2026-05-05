import type {
  SubagentToolCall,
  SubagentToolSpec,
} from "@harness/agent-kit/types";
import { truncate } from "@harness/utils";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { branchEntries } from "./branch-entries";
import { findEntries } from "./find-entries";
import { labels } from "./labels";
import { readEntry } from "./read-entry";
import { sessionOverview } from "./session-overview";
import { treeOutline } from "./tree-outline";

export const tools: SubagentToolSpec[] = [
  {
    type: "custom",
    name: sessionOverview.name,
    spec: () => sessionOverview,
    render: (toolCall, _options, theme) =>
      renderLine(toolCall, theme, "Get Overview", ""),
  },
  {
    type: "custom",
    name: branchEntries.name,
    spec: () => branchEntries,
    render: (toolCall, _options, theme) =>
      renderLine(toolCall, theme, "Read branch", formatBranchDetails(toolCall)),
  },
  {
    type: "custom",
    name: readEntry.name,
    spec: () => readEntry,
    render: (toolCall, _options, theme) =>
      renderLine(toolCall, theme, "Read", formatArg(toolCall, "id")),
  },
  {
    type: "custom",
    name: findEntries.name,
    spec: () => findEntries,
    render: (toolCall, _options, theme) =>
      renderLine(
        toolCall,
        theme,
        "Search",
        quote(formatArg(toolCall, "query")),
      ),
  },
  {
    type: "custom",
    name: labels.name,
    spec: () => labels,
    render: (toolCall, _options, theme) =>
      renderLine(toolCall, theme, "List labels", ""),
  },
  {
    type: "custom",
    name: treeOutline.name,
    spec: () => treeOutline,
    render: (toolCall, _options, theme) =>
      renderLine(toolCall, theme, "Tree outline", ""),
  },
];

function renderLine(
  toolCall: SubagentToolCall,
  theme: Theme,
  action: string,
  details: string,
) {
  return new Text(
    [
      formatIndicator(toolCall, theme),
      theme.fg("toolTitle", action),
      theme.fg("thinkingMinimal", details),
    ].join(" "),
    0,
    0,
  );
}

function formatBranchDetails(toolCall: SubagentToolCall) {
  const parts = [
    toolCall.args.leafId ? `leaf ${formatArg(toolCall, "leafId")}` : undefined,
    toolCall.args.limit ? `last ${String(toolCall.args.limit)}` : undefined,
    toolCall.args.fromEnd ? "leaf-to-root" : "root-to-leaf",
  ];

  return parts.filter(Boolean).join(", ");
}

function formatArg(toolCall: SubagentToolCall, name: string) {
  const value = toolCall.args[name];
  if (value === undefined || value === null) return "?";
  return truncate(String(value), 56);
}

function quote(value: string) {
  return `“${value}”`;
}

function formatIndicator(toolCall: SubagentToolCall, theme: Theme): string {
  switch (toolCall.status) {
    case "running":
      return theme.fg("accent", "・");
    case "success":
      return theme.fg("success", "✓");
    case "error":
      return theme.fg("error", "✗");
  }
}
