import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

export function truncateSafe(
  text: string,
  width: number,
  theme: Theme,
): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return text.slice(0, width);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI
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

export function renderProgressBar(
  percent: number,
  width: number,
  theme: Theme,
  fillColor: "success" | "warning" | "error",
  pacePercent?: number | null,
  markerPercent?: number | null,
): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * width);
  const paceIndex =
    pacePercent == null ||
    pacePercent <= percent ||
    pacePercent < 5 ||
    pacePercent > 95
      ? null
      : Math.min(
          width - 1,
          Math.round((Math.max(0, Math.min(100, pacePercent)) / 100) * width),
        );
  const markerIndex =
    markerPercent == null || markerPercent < 5 || markerPercent > 95
      ? null
      : Math.min(
          width - 1,
          Math.round((Math.max(0, Math.min(100, markerPercent)) / 100) * width),
        );

  const parts: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i === markerIndex) {
      parts.push(theme.fg("dim", "\u2502"));
    } else if (i === paceIndex) {
      parts.push(theme.fg("dim", "\u2502"));
    } else if (i < filled) {
      parts.push(theme.fg(fillColor, "\u2588"));
    } else {
      parts.push(theme.fg("dim", "\u2591"));
    }
  }
  return parts.join("");
}

export function formatLastUpdated(date: Date): string {
  if (date.getTime() === 0) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 24 * 60 * 60_000) {
    return `${Math.floor(diffMs / (60 * 60_000))}h ago`;
  }
  return date.toLocaleString();
}
