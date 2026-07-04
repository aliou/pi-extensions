import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import { formatDisplayPath, isNotNil } from "@harness/utils";
import type { SubagentConfig } from "../../types";
import type { SubagentRenderState, ToolRenderContext } from "./types";

export function formatSubagentCwd(
  cwdArg: unknown,
  ctxCwd: string,
): string | undefined {
  if (!cwdArg || typeof cwdArg !== "string") return undefined;
  return formatDisplayPath(cwdArg, ctxCwd);
}

export function renderSubagentCall(
  config: SubagentConfig,
  args: Record<string, unknown>,
  theme: Theme,
  ctx: ToolRenderContext<SubagentRenderState>,
) {
  if (config.renderHeader) {
    return config.renderHeader(args, theme, ctx);
  }

  const cwd = formatSubagentCwd(args.cwd, ctx.cwd);
  return renderDefaultHeader(config, args, theme, cwd);
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
  cwd?: string;
}) {
  const { label, body, theme, resuming, cwd } = opts;
  const title = theme.fg("toolTitle", theme.bold(label));
  const trimmed = body.trim();
  const suffixes: string[] = [];
  if (resuming) suffixes.push(theme.fg("muted", "(resuming)"));
  if (cwd) suffixes.push(theme.fg("muted", `(cwd: ${cwd})`));
  const suffix = suffixes.length ? ` ${suffixes.join(" ")}` : "";
  const text = trimmed ? `${title} ${trimmed}${suffix}` : `${title}${suffix}`;
  return new Markdown(text, 0, 0, getMarkdownTheme());
}

function renderDefaultHeader(
  config: SubagentConfig,
  args: Record<string, unknown>,
  theme: Theme,
  cwd?: string,
) {
  const displayArgs = Object.entries(args)
    .filter(([key]) => key !== "sessionId" && key !== "cwd")
    .map(([key, value]) => `${theme.fg("dim", key)}: ${String(value)}`)
    .join(", ");
  const resuming = isNotNil(args.sessionId);

  const suffixes: string[] = [];
  if (resuming) suffixes.push(theme.fg("muted", "(resuming)"));
  if (cwd) suffixes.push(theme.fg("muted", `(cwd: ${cwd})`));

  const header = [
    theme.fg("toolTitle", theme.bold(config.label)),
    displayArgs ? theme.fg("text", displayArgs) : undefined,
    ...suffixes,
  ]
    .filter(Boolean)
    .join(" ");

  return new Text(header, 0, 0);
}
