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
import type { ArtisanParamsType } from "./types";

export function renderArtisanHeader(
  args: ArtisanParamsType & { sessionId?: string },
  theme: Theme,
  _ctx: ToolRenderContext,
) {
  return renderHeaderMarkdown({
    label: "Artisan",
    body: args.task ?? "",
    theme,
    resuming: isNotNil(args.sessionId),
  });
}

export function renderArtisanDetails(
  args: ArtisanParamsType,
  _theme: Theme,
  cwd: string,
) {
  const sections: string[] = [];
  if (args.context?.trim()) {
    sections.push(`**Context**\n${args.context.trim()}`);
  }
  if (args.files?.length) {
    sections.push(
      `**Files**\n${args.files
        .map((file) => `- ${formatDisplayPath(file, cwd)}`)
        .join("\n")}`,
    );
  }
  if (sections.length === 0) return undefined;
  return new Markdown(sections.join("\n\n"), 0, 0, getMarkdownTheme());
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

export const artisanToolRenderers = {
  read: line("Read", (t, cwd) => path(t, "path", cwd)),
  grep: line("Grep", (t) => quote(arg(t, "pattern"))),
  find: line("Find", (t) => quote(arg(t, "pattern"))),
  read_url: line("Read URL", (t) => arg(t, "url")),
  find_sessions: line("Find sessions", (t) => quote(arg(t, "query"))),
  read_session: line("Read session", (t) => arg(t, "goal")),
  synthetic_web_search: line("Web search", (t) => quote(arg(t, "query"))),
} satisfies Record<string, SubagentToolRenderer>;

function path(toolCall: SubagentToolCall, name: string, cwd: string) {
  const value = arg(toolCall, name);
  return value ? formatDisplayPath(value, cwd) : "";
}

function quote(value: string) {
  return value ? `“${value}”` : "";
}
