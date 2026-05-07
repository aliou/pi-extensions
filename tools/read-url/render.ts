/**
 * Read URL tool render functions.
 */

import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme, keyText } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import type { ReadUrlDetails } from "./types";
import { DEFAULT_PREVIEW_MAX_LINES } from "./utils/temp-file-preview";

export function renderCall(args: { url: string }, theme: Theme) {
  return new ToolCallHeader(
    {
      toolName: "Read URL",
      mainArg: args.url.trim(),
      showColon: true,
    },
    theme,
  );
}

export function renderResult(
  result: AgentToolResult<ReadUrlDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "Read URL: fetching..."), 0, 0);
  }

  const isError = Boolean((result as { isError?: boolean }).isError);
  const textBlock = result.content.find((c) => c.type === "text");
  const markdownText =
    textBlock?.type === "text" && textBlock.text ? textBlock.text : "";
  const tempFilePath = result.details?.tempFilePath;
  const totalLines = result.details?.totalLines;

  const container = new Container();

  if (isError) {
    const errorText = markdownText || "Read URL failed";
    container.addChild(new Text(theme.fg("error", errorText), 0, 0));
  } else if (markdownText) {
    const collapsed = !options.expanded;

    if (collapsed) {
      const lines = markdownText.split("\n");
      const visibleText = lines.slice(0, 8).join("\n");
      const remaining = Math.max(lines.length - 8, 0);

      container.addChild(
        new Markdown(visibleText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );

      if (remaining > 0) {
        container.addChild(
          new Text(
            theme.fg(
              "muted",
              `... (${remaining} more lines, ${keyText("app.tools.expand")} to expand)`,
            ),
            0,
            0,
          ),
        );
      }
    } else {
      container.addChild(
        new Markdown(markdownText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );
    }

    // Show temp file path so the user knows where the full content lives.
    if (tempFilePath && totalLines && totalLines > DEFAULT_PREVIEW_MAX_LINES) {
      container.addChild(
        new Text(
          theme.fg(
            "muted",
            `Full content (${totalLines} lines) saved to: ${tempFilePath}`,
          ),
          0,
          0,
        ),
      );
    }
  } else {
    container.addChild(
      new Text(theme.fg("muted", "Read URL: no content"), 0, 0),
    );
  }

  const status = result.details?.statusCode
    ? `${result.details.statusCode}${
        result.details.statusText ? ` ${result.details.statusText}` : ""
      }`
    : "n/a";
  const failed = isError || result.details?.failed === true ? "yes" : "no";
  const handler = result.details?.handler ?? "unknown";

  container.addChild(new Text("", 0, 0));
  container.addChild(
    new Text(
      `${theme.fg("muted", "handler=")}${theme.fg("dim", handler)}  ${theme.fg("muted", "HTTP:")} ${theme.fg("dim", status)}  ${theme.fg("muted", "failed=")}${theme.fg(failed === "yes" ? "error" : "success", failed)}`,
      0,
      0,
    ),
  );

  return container;
}
