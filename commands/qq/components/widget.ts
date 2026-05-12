import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Loader } from "@earendil-works/pi-tui";
import { wrapInRoundedBorder } from "@harness/ui/border";
import { renderQqAnswerCard } from "../render";
import type { QqAnswerDetails } from "../types";

export const QQ_WIDGET_ID = "qq";

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
          const visibleLoaderLines =
            loaderLines[0] === "" ? loaderLines.slice(1) : loaderLines;
          const padded = visibleLoaderLines.map((line) => ` ${line} `);
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
  details: QqAnswerDetails,
): void {
  ctx.ui.setWidget(
    QQ_WIDGET_ID,
    (_tui, theme) => ({
      render(width: number) {
        return renderQqAnswerCard(
          details,
          { expanded: true, includeHint: false },
          theme,
          width,
        );
      },
      handleInput() {},
      invalidate() {},
    }),
    { placement: "aboveEditor" },
  );
}

export function clearQqWidget(ctx: QqWidgetContext): void {
  ctx.ui.setWidget(QQ_WIDGET_ID, undefined);
}
