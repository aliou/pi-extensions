import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Loader, Markdown, Text, visibleWidth } from "@mariozechner/pi-tui";

export const QQ_WIDGET_ID = "qq";

type QqModel = { provider: string; id: string };
type QqWidgetContext = Pick<ExtensionCommandContext, "ui">;

/**
 * Wrap content lines in a rounded border with 1-char inner padding.
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

export function showLoadingWidget(
  ctx: ExtensionCommandContext,
  question: string,
): void {
  ctx.ui.setWidget(
    QQ_WIDGET_ID,
    (tui, theme) => {
      const borderColor = (t: string) => theme.fg("warning", t);
      const loader = new Loader(
        tui,
        (s) => theme.fg("accent", s),
        (s) => theme.fg("muted", s),
        `qq: ${question}`,
      );
      loader.start();

      return {
        render(width: number) {
          const contentWidth = Math.max(1, width - 4);
          const loaderLines = loader.render(contentWidth);
          const padded = loaderLines.map((line) => ` ${line} `);
          return wrapInRoundedBorder(padded, width, borderColor);
        },
        handleInput() {},
        invalidate() {
          loader.invalidate();
        },
        dispose() {
          loader.stop();
        },
      };
    },
    { placement: "aboveEditor" },
  );
}

export function showResultWidget(
  ctx: ExtensionCommandContext,
  question: string,
  answer: string,
  model: QqModel,
): void {
  ctx.ui.setWidget(
    QQ_WIDGET_ID,
    (_tui, theme) => {
      const borderColor = (t: string) => theme.fg("success", t);
      const mdTheme = getMarkdownTheme();

      return {
        render(width: number) {
          const contentWidth = Math.max(1, width - 4);
          const content: string[] = [];

          content.push(
            theme.fg("customMessageLabel", `\x1b[1mqq:\x1b[22m `) + question,
          );
          content.push("");

          const paragraphs = answer.split(/\n\n/).filter((p) => p.trim());
          const firstParagraph = paragraphs[0] ?? "";
          try {
            const md = new Markdown(firstParagraph, 0, 0, mdTheme);
            content.push(...md.render(contentWidth));
          } catch {
            content.push(
              ...new Text(firstParagraph, 0, 0).render(contentWidth),
            );
          }

          content.push("");
          content.push(theme.fg("dim", `(${model.provider}/${model.id})`));

          const padded = content.map((line) => ` ${line} `);
          return wrapInRoundedBorder(padded, width, borderColor);
        },
        handleInput() {},
        invalidate() {},
      };
    },
    { placement: "aboveEditor" },
  );
}

export function clearQqWidget(ctx: QqWidgetContext): void {
  ctx.ui.setWidget(QQ_WIDGET_ID, undefined);
}
