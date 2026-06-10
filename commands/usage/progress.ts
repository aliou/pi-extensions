import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { UsageSeverity } from "./types";

export function truncateSafe(
  text: string,
  width: number,
  theme: Theme,
): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return text.slice(0, width);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence stripping
  const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
  return `${plain.slice(0, Math.max(0, width - 3))}${theme.fg("dim", "...")}`;
}

export function ensureWidth(
  lines: string[],
  width: number,
  theme: Theme,
): string[] {
  return lines.map((line) => {
    if (visibleWidth(line) <= width) return line;
    const wrapped = wrapTextWithAnsi(line, width);
    return wrapped[0] ?? truncateSafe(line, width, theme);
  });
}

export function severityColor(
  severity: UsageSeverity,
): "success" | "warning" | "error" | "dim" {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "warning") return "warning";
  return "success";
}

export function renderProgressBar(
  percent: number,
  width: number,
  theme: Theme,
  fillColor: "success" | "warning" | "error" | "dim",
  markerPercent?: number | null,
  pacePercent?: number | null,
): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * width);
  const markerIndex = barIndex(markerPercent, width);
  const paceIndex =
    pacePercent == null || pacePercent <= percent
      ? null
      : barIndex(pacePercent, width);

  const parts: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i === markerIndex || i === paceIndex) parts.push(theme.fg("dim", "│"));
    else if (i < filled) parts.push(theme.fg(fillColor, "█"));
    else parts.push(theme.fg("dim", "░"));
  }
  return parts.join("");
}

function barIndex(
  percent: number | null | undefined,
  width: number,
): number | null {
  if (percent == null || percent < 5 || percent > 95) return null;
  return Math.min(
    width - 1,
    Math.round((Math.max(0, Math.min(100, percent)) / 100) * width),
  );
}
