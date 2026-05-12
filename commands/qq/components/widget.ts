import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Loader, Markdown } from "@earendil-works/pi-tui";
import { wrapInRoundedBorder } from "@harness/ui/border";

export const QQ_WIDGET_ID = "qq";

type QqModel = { provider: string; id: string };
type QqWidgetContext = Pick<ExtensionCommandContext, "ui">;

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
          return wrapInRoundedBorder(padded, { width, color: borderColor });
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

          const md = new Markdown(answer, 0, 0, mdTheme);
          content.push(...md.render(contentWidth));

          content.push("");
          content.push(theme.fg("dim", `(${model.provider}/${model.id})`));

          const padded = content.map((line) => ` ${line} `);
          return wrapInRoundedBorder(padded, { width, color: borderColor });
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
