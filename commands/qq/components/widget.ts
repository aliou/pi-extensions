import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Loader, Markdown } from "@earendil-works/pi-tui";
import type { SubagentDetails } from "@harness/agent-kit/runtime";
import { wrapInRoundedBorder } from "@harness/ui/border";

export const QQ_WIDGET_ID = "qq";

type QqWidgetContext = Pick<ExtensionCommandContext, "ui">;

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatFooter(details: SubagentDetails): string {
  const parts: string[] = [];
  const { usage } = details;

  if (usage.input > 0) parts.push(`↑${formatTokenCount(usage.input)}`);
  if (usage.output > 0) parts.push(`↓${formatTokenCount(usage.output)}`);
  if (usage.cacheRead > 0) parts.push(`R${formatTokenCount(usage.cacheRead)}`);
  if (usage.cacheWrite > 0)
    parts.push(`W${formatTokenCount(usage.cacheWrite)}`);
  if (usage.cost.total > 0) parts.push(formatCost(usage.cost.total));

  if (details.model) {
    parts.push(`(${details.model.provider}/${details.model.model})`);
  }

  return parts.join(" ");
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
  question: string,
  answer: string,
  details: SubagentDetails,
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

          const footer = formatFooter(details);
          if (footer) {
            content.push("");
            content.push(theme.fg("dim", footer));
          }

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
