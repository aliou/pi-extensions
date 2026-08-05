import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { CacheFreshness } from "./cache-status";

/**
 * Cache-hit-rate color tiers for the footer.
 *   90–100%: success (green)
 *   80–90%:  warning (orange)
 *   below 80%: error (red)
 */
export const CACHE_HIT_RATE_WARNING_THRESHOLD = 90;
export const CACHE_HIT_RATE_ERROR_THRESHOLD = 80;

const THINKING_LEVEL_COLOR_MAP: Record<string, ThemeColor> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
};

function thinkingLevelToColorToken(level: string): ThemeColor {
  return THINKING_LEVEL_COLOR_MAP[level] ?? "thinkingMinimal";
}

/**
 * Build the cache hit rate segment for the model line.
 *
 * Colored by tier:
 *   90–100%: success (green)
 *   80–90%:  warning (orange)
 *   below 80%: error (red)
 * Returns an empty string when no cache activity has been recorded yet.
 */
function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h${restMinutes}m`;
}

function getCacheHitRateColor(cacheHitRate: number | undefined): ThemeColor {
  if (cacheHitRate === undefined) return "success";
  return cacheHitRate >= CACHE_HIT_RATE_WARNING_THRESHOLD
    ? "success"
    : cacheHitRate >= CACHE_HIT_RATE_ERROR_THRESHOLD
      ? "warning"
      : "error";
}

function buildCachePart(
  theme: Theme,
  cacheHitRate: number | undefined,
  cacheFreshness?: CacheFreshness | undefined,
): string {
  // Cache unusable: expired or unknown. Show the empty set and, when we
  // know how long ago it expired, a rounded relative duration. Hit rate is
  // no longer relevant once the cache is gone, so it is dropped entirely.
  if (
    cacheFreshness?.state === "stale" ||
    cacheFreshness?.state === "unknown"
  ) {
    const color = cacheFreshness.state === "stale" ? "error" : "warning";
    return theme.fg(color, "∅ ");
  }

  const remainingMs =
    cacheFreshness?.state === "valid" &&
    cacheFreshness.ttlMs !== undefined &&
    cacheFreshness.ageMs !== undefined
      ? Math.max(0, cacheFreshness.ttlMs - cacheFreshness.ageMs)
      : undefined;

  if (cacheHitRate === undefined && remainingMs === undefined) {
    return "";
  }

  const hitRateText =
    cacheHitRate === undefined ? "≡" : `≡ ${cacheHitRate.toFixed(0)}%`;
  const remainingText =
    remainingMs === undefined ? "" : ` ${formatRemaining(remainingMs)}`;
  return theme.fg(
    getCacheHitRateColor(cacheHitRate),
    `${hitRateText}${remainingText} `,
  );
}

/**
 * Build model line for footer line 2 right side
 */
export function buildModelLine(
  theme: Theme,
  provider: string | undefined,
  modelId: string | undefined,
  hasReasoning: boolean,
  thinkingLevel: string,
  cacheHitRate?: number | undefined,
  cacheFreshness?: CacheFreshness | undefined,
): string {
  const cachePart = buildCachePart(theme, cacheHitRate, cacheFreshness);
  const providerName = provider ?? "unknown";
  const modelPart = `${providerName}/${modelId ?? "no-model"}:`;

  if (hasReasoning) {
    const formattedLevel =
      thinkingLevel !== "off"
        ? thinkingLevel.slice(0, 3) // min, med, max
        : "off";
    const thinkingColorToken = thinkingLevelToColorToken(thinkingLevel);
    return (
      cachePart +
      theme.fg("thinkingMinimal", modelPart) +
      theme.fg(thinkingColorToken, formattedLevel)
    );
  }

  return (
    cachePart +
    theme.fg("thinkingMinimal", modelPart) +
    theme.fg("thinkingOff", "none")
  );
}

/**
 * Build model ID only (no provider, no thinking level)
 */
export function buildModelIdLine(
  theme: Theme,
  modelId: string | undefined,
): string {
  return theme.fg("thinkingMinimal", modelId ?? "no-model");
}
