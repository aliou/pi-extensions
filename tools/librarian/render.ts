import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import {
  renderHeaderMarkdown,
  renderSubagentToolLine,
  type ToolRenderContext,
} from "@harness/agent-kit/runtime";
import type {
  SubagentToolCall,
  SubagentToolRenderer,
} from "@harness/agent-kit/types";
import { formatDisplayPath, isNotNil } from "@harness/utils";
import type { LibrarianParamsType } from "./types";

export function renderLibrarianHeader(
  args: LibrarianParamsType & { sessionId?: string },
  theme: Theme,
  _ctx: ToolRenderContext,
) {
  return renderHeaderMarkdown({
    label: "Librarian",
    body: args.query ?? "",
    theme,
    resuming: isNotNil(args.sessionId),
  });
}

export function renderLibrarianDetails(
  args: LibrarianParamsType,
  _theme: Theme,
  _cwd: string,
) {
  if (!args.context?.trim()) return undefined;
  return new Markdown(
    `**Context**\n${args.context.trim()}`,
    0,
    0,
    getMarkdownTheme(),
  );
}

function arg(toolCall: SubagentToolCall, name: string) {
  const value = toolCall.args[name];
  if (value === undefined || value === null) return "";
  return String(value);
}

const line =
  (
    action: string,
    details: (toolCall: SubagentToolCall, cwd: string) => string = () => "",
  ): SubagentToolRenderer =>
  (toolCall, _options, theme, cwd) =>
    renderSubagentToolLine(toolCall, theme, action, details(toolCall, cwd));

export const librarianToolRenderers = {
  ls: line("List", (t, cwd) => path(t, "path", cwd)),
  read: line("Read", (t, cwd) => path(t, "path", cwd)),
  find: line("Find", (t) => quote(arg(t, "pattern"))),
  grep: line("Grep", (t) => quote(arg(t, "pattern"))),
  checkout_repo: line("Checkout", (t) => arg(t, "repository")),
  git_log: line("Git log", (t) => quote(arg(t, "grep"))),
  git_show: line("Git show", (t) => arg(t, "rev")),
  search_github: line(
    "Search GitHub",
    (t) => `${quote(arg(t, "pattern"))} in ${arg(t, "repository")}`,
  ),
  list_repositories: line(
    "List repos",
    (t) => arg(t, "organization") || arg(t, "pattern"),
  ),
} satisfies Record<string, SubagentToolRenderer>;

function path(toolCall: SubagentToolCall, name: string, cwd: string) {
  const value = arg(toolCall, name);
  return value ? formatDisplayPath(value, cwd) : "";
}

function quote(value: string) {
  return value ? `\u201c${value}\u201d` : "";
}
