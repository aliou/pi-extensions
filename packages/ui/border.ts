import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type BorderColor = (text: string) => string;

export interface WrapInRoundedBorderOptions {
  width: number;
  color: BorderColor;
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
  const { width, color } = options;
  const innerWidth = Math.max(1, width - 2);
  const top = color(`╭${"─".repeat(innerWidth)}╮`);
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
