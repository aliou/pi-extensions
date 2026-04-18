import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@mariozechner/pi-coding-agent";
import {
  Container,
  Markdown,
  type MarkdownTheme,
  Text,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import { QQ_MESSAGE_TYPE, type QqDetails, qqPending } from "./types";

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function buildFooterLine(details: QqDetails): string {
  const parts: string[] = [];
  const u = details.usage;

  if (u) {
    if (u.inputTokens != null) {
      parts.push(`\u2191${formatTokenCount(u.inputTokens)}`);
    }
    if (u.outputTokens != null) {
      parts.push(`\u2193${formatTokenCount(u.outputTokens)}`);
    }
    if (u.cacheReadTokens != null && u.cacheReadTokens > 0) {
      parts.push(`R${formatTokenCount(u.cacheReadTokens)}`);
    }
    if (u.cacheWriteTokens != null && u.cacheWriteTokens > 0) {
      parts.push(`W${formatTokenCount(u.cacheWriteTokens)}`);
    }
    if (u.llmCost != null && u.llmCost > 0) {
      parts.push(
        u.llmCost < 1 ? `$${u.llmCost.toFixed(4)}` : `$${u.llmCost.toFixed(2)}`,
      );
    }
  }

  parts.push(`(${details.provider}/${details.model})`);

  return parts.join(" ");
}

/**
 * Wrap content lines in a rounded Unicode box border with 1-char inner padding.
 */
function wrapInRoundedBorder(
  lines: string[],
  width: number,
  colorFn: (t: string) => string,
): string[] {
  const innerWidth = Math.max(1, width - 2);
  const hBar = "\u2500".repeat(innerWidth);
  const top = colorFn(`\u256D${hBar}\u256E`);
  const bottom = colorFn(`\u2570${hBar}\u256F`);
  const left = colorFn("\u2502");
  const right = colorFn("\u2502");

  const wrapped = lines.map((line) => {
    const contentWidth = visibleWidth(line);
    const fill = Math.max(0, innerWidth - contentWidth);
    return `${left}${line}${" ".repeat(fill)}${right}`;
  });

  return [top, ...wrapped, bottom];
}

export function registerQqRenderer(pi: ExtensionAPI): void {
  pi.registerMessageRenderer<QqDetails>(
    QQ_MESSAGE_TYPE,
    (message, options, theme) => {
      const details = message.details;

      // While the message is pending (added during an active turn),
      // hide it in the session view. The result is shown in a widget
      // above the editor instead. When the next turn starts, the pending
      // state is cleared and this renderer displays normally.
      if (details?.timestamp && qqPending.has(details.timestamp)) {
        return new Container(); // renders zero lines — invisible
      }
      const question = details?.question ?? "";
      const answer = details?.answer ?? "";
      const expanded = options.expanded ?? false;

      const header = new ToolCallHeader(
        { toolName: "qq", showColon: true, mainArg: question },
        theme,
      );

      let mdTheme: MarkdownTheme | null = null;
      let md: Markdown | null = null;

      const footerLine = details ? buildFooterLine(details) : "";
      const borderColor = (t: string) => theme.fg("success", t);

      return {
        render(width: number) {
          // border (2) + inner padding (2)
          const contentWidth = Math.max(1, width - 4);
          const content: string[] = [];

          content.push(...header.render(contentWidth));

          if (expanded) {
            // Expanded: show full answer
            if (answer) {
              content.push("");
              try {
                if (!mdTheme) mdTheme = getMarkdownTheme();
                if (!md) md = new Markdown(answer, 0, 0, mdTheme);
                content.push(...md.render(contentWidth));
              } catch {
                content.push(...new Text(answer, 0, 0).render(contentWidth));
              }
            }

            // Footer on its own line in expanded mode
            if (footerLine) {
              content.push("");
              content.push(
                theme.fg("muted", truncateToWidth(footerLine, contentWidth)),
              );
            }
          } else {
            // Collapsed: show first paragraph of answer
            const paragraphs = answer.split(/\n\n/).filter((p) => p.trim());
            const firstParagraph = paragraphs[0] ?? "";
            const remainingParagraphs = paragraphs.length - 1;

            if (firstParagraph) {
              content.push("");
              try {
                if (!mdTheme) mdTheme = getMarkdownTheme();
                if (!md) md = new Markdown(firstParagraph, 0, 0, mdTheme);
                content.push(...md.render(contentWidth));
              } catch {
                content.push(
                  ...new Text(firstParagraph, 0, 0).render(contentWidth),
                );
              }
            }

            // Footer line with more paragraphs hint and token/cost/model info
            const hint = keyHint("app.tools.expand", "to expand");
            const moreParagraphsHint =
              remainingParagraphs > 0
                ? `(${remainingParagraphs} more paragraphs, ${hint}) `
                : `(${hint}) `;
            const collapsedLine = moreParagraphsHint + (footerLine ?? "");
            content.push("");
            content.push(
              theme.fg("dim", truncateToWidth(collapsedLine, contentWidth)),
            );
          }

          const padded = content.map((line) => ` ${line} `);
          return wrapInRoundedBorder(padded, width, borderColor);
        },
        handleInput(_data: string) {
          return false;
        },
        invalidate() {
          md?.invalidate();
        },
      };
    },
  );
}
