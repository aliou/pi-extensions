/**
 * Bash tool render functions.
 */

import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  formatSize,
  keyHint,
  truncateToVisualLines,
} from "@earendil-works/pi-coding-agent";
import { Box, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { sanitizeShellOutput } from "./sanitize";

/** Lines to show when collapsed. Matches the native bash tool. */
const BASH_PREVIEW_LINES = 5;

/** Extract text content from a tool result. */
export function getTextOutput(result: AgentToolResult<unknown>): string {
  const textBlocks = result.content?.filter((c) => c.type === "text") || [];
  return textBlocks
    .map((c) => {
      const text = "text" in c && c.text ? c.text : "";
      return sanitizeShellOutput(text).replace(/\r/g, "");
    })
    .join("\n")
    .trim();
}

export function renderCall(
  args: Record<string, unknown>,
  theme: Theme,
  homedir: string,
) {
  const command = args.command ?? "";
  const timeout = args.timeout as number | undefined;
  const cwdArg = args.cwd as string | undefined;

  const commandDisplay = command ? command : theme.fg("toolOutput", "...");
  const cwdDisplay = cwdArg?.startsWith(homedir)
    ? `~${cwdArg.slice(homedir.length)}`
    : cwdArg;
  const cwdSuffix = cwdDisplay
    ? theme.fg("muted", ` (cwd: ${cwdDisplay})`)
    : "";
  const timeoutSuffix = timeout
    ? theme.fg("muted", ` (timeout ${timeout}s)`)
    : "";

  return new Text(
    `${theme.fg("toolTitle", theme.bold(`$ ${commandDisplay}`))}${cwdSuffix}${timeoutSuffix}`,
    0,
    0,
  );
}

export function renderResult(
  result: AgentToolResult<unknown>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const box = new Box(0, 0);
  const output = getTextOutput(result);

  if (output) {
    const styledOutput = output
      .split("\n")
      .map((line: string) => theme.fg("toolOutput", line))
      .join("\n");

    if (options.expanded) {
      box.addChild(new Text(`\n${styledOutput}`, 0, 0));
    } else {
      // Visual line truncation with width-aware caching (matches native)
      let cachedWidth: number | undefined;
      let cachedLines: string[] | undefined;
      let cachedSkipped: number | undefined;

      box.addChild({
        render: (width: number) => {
          if (cachedLines === undefined || cachedWidth !== width) {
            const r = truncateToVisualLines(
              styledOutput,
              BASH_PREVIEW_LINES,
              width,
            );
            cachedLines = r.visualLines;
            cachedSkipped = r.skippedCount;
            cachedWidth = width;
          }
          if (cachedSkipped && cachedSkipped > 0) {
            const hint = `${theme.fg("muted", `... (${cachedSkipped} earlier lines,`)} ${keyHint("app.tools.expand", "to expand")})`;
            return ["", truncateToWidth(hint, width, "..."), ...cachedLines];
          }
          return ["", ...cachedLines];
        },
        invalidate: () => {
          cachedWidth = undefined;
          cachedLines = undefined;
          cachedSkipped = undefined;
        },
      });
    }
  }

  // Truncation warnings
  const details = result.details as Record<string, unknown> | undefined;
  const truncation = details?.truncation as Record<string, unknown> | undefined;
  const fullOutputPath = details?.fullOutputPath as string | undefined;
  if (truncation?.truncated || fullOutputPath) {
    const warnings: string[] = [];
    if (fullOutputPath) {
      warnings.push(`Full output: ${fullOutputPath}`);
    }
    if (truncation?.truncated) {
      if (truncation.truncatedBy === "lines") {
        warnings.push(
          `Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
        );
      } else {
        warnings.push(
          `Truncated: ${truncation.outputLines} lines shown (${formatSize((truncation.maxBytes as number) ?? DEFAULT_MAX_BYTES)} limit)`,
        );
      }
    }
    box.addChild(
      new Text(`\n${theme.fg("warning", `[${warnings.join(". ")}]`)}`, 0, 0),
    );
  }

  // Elapsed / Took duration
  const durationMs = details?._durationMs as number | undefined;
  if (!options.isPartial && durationMs !== undefined) {
    box.addChild(
      new Text(
        `\n${theme.fg("muted", `Took ${(durationMs / 1000).toFixed(1)}s`)}`,
        0,
        0,
      ),
    );
  }

  return box;
}
