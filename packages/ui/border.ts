import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type BorderColor = (text: string) => string;

export interface WrapInRoundedBorderOptions {
  width: number;
  color: BorderColor;
  title?: string;
  hint?: string;
}

/**
 * Wrap pre-rendered content lines in a rounded border.
 *
 * Lines are truncated before padding, so every rendered output line fits the
 * requested width. Callers that want inner padding should include it in the
 * provided lines, e.g. `lines.map((line) => ` ${line} `)`.
 */
export function wrapInRoundedBorder(
  lines: string[],
  options: WrapInRoundedBorderOptions,
): string[] {
  const { width, color, title, hint } = options;
  const innerWidth = Math.max(1, width - 2);
  const top = formatTopBorder(innerWidth, color, title, hint);
  const bottom = color(`╰${"─".repeat(innerWidth)}╯`);
  const left = color("│");
  const right = color("│");

  return [
    top,
    ...lines.map((line) => {
      const truncated = truncateToWidth(line, innerWidth);
      const fill = Math.max(0, innerWidth - visibleWidth(truncated));
      return `${left}${truncated}${" ".repeat(fill)}${right}`;
    }),
    bottom,
  ];
}

function formatTopBorder(
  innerWidth: number,
  color: BorderColor,
  title?: string,
  hint?: string,
): string {
  if (!title && !hint) return color(`╭${"─".repeat(innerWidth)}╮`);

  const parts = [title, hint].filter((part): part is string => Boolean(part));
  const label = ` ${parts.join(" ")} `;
  const availableLabelWidth = Math.max(0, innerWidth - 1);
  const renderedLabel = truncateToWidth(label, availableLabelWidth);
  const fill = Math.max(0, innerWidth - 1 - visibleWidth(renderedLabel));

  return `${color("╭─")}${renderedLabel}${color("─".repeat(fill))}${color("╮")}`;
}
