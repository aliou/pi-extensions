import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import { isNotNil } from "@harness/utils";
import type { SubagentConfig } from "../../types";
import type { ToolRenderContext } from "./types";

export function renderSubagentCall(
  config: SubagentConfig,
  args: Record<string, unknown>,
  theme: Theme,
  ctx: ToolRenderContext,
) {
  if (config.renderHeader) {
    return config.renderHeader(args, theme, ctx);
  }

  return renderDefaultHeader(config, args, theme);
}

/**
 * Build a subagent call header as a single Markdown block: a tool-colored
 * label followed inline by the prompt body (Markdown wraps automatically).
 * When `resuming` is true, a muted `(resuming)` suffix is appended.
 */
export function renderHeaderMarkdown(opts: {
  label: string;
  body: string;
  theme: Theme;
  resuming?: boolean;
}) {
  const { label, body, theme, resuming } = opts;
  const title = theme.fg("toolTitle", theme.bold(label));
  const trimmed = body.trim();
  const suffix = resuming ? ` ${theme.fg("muted", "(resuming)")}` : "";
  const text = trimmed ? `${title} ${trimmed}${suffix}` : `${title}${suffix}`;
  return new Markdown(text, 0, 0, getMarkdownTheme());
}

function renderDefaultHeader(
  config: SubagentConfig,
  args: Record<string, unknown>,
  theme: Theme,
) {
  const displayArgs = Object.entries(args)
    .filter(([key]) => key !== "sessionId")
    .map(([key, value]) => `${theme.fg("dim", key)}: ${String(value)}`)
    .join(", ");
  const resuming = isNotNil(args.sessionId);

  const header = [
    theme.fg("toolTitle", theme.bold(config.label)),
    displayArgs ? theme.fg("text", displayArgs) : undefined,
    resuming && theme.fg("muted", "(resuming)"),
  ]
    .filter(Boolean)
    .join(" ");

  return new Text(header, 0, 0);
}
