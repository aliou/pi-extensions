import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

const FAST_SYMBOL = "\u26A1";

/**
 * Cache-hit-rate color tiers for the footer.
 *   90–100%: success (green)
 *   80–90%:  warning (orange)
 *   below 80%: error (red)
 */
export const CACHE_HIT_RATE_WARNING_THRESHOLD = 90;
export const CACHE_HIT_RATE_ERROR_THRESHOLD = 80;

/**
 * Set of providers with fast mode currently enabled.
 * Updated by the chrome footer via the AD_MODEL_FAST_MODE_CHANGED_EVENT.
 */
const fastModeProviders = new Set<string>();

export function setFastModeProvider(provider: string, enabled: boolean): void {
  if (enabled) {
    fastModeProviders.add(provider);
  } else {
    fastModeProviders.delete(provider);
  }
}

function getFastPrefix(provider: string | undefined): string {
  if (!provider || !fastModeProviders.has(provider)) return "";
  return `${FAST_SYMBOL} `;
}

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
 * Rendered before the fast-mode symbol so it sits to the left of the model
 * name. Colored by tier:
 *   90–100%: success (green)
 *   80–90%:  warning (orange)
 *   below 80%: error (red)
 * Returns an empty string when no cache activity has been recorded yet.
 */
function buildCacheHitRatePart(
  theme: Theme,
  cacheHitRate: number | undefined,
): string {
  if (cacheHitRate === undefined) return "";
  const text = `cache ${cacheHitRate.toFixed(0)}% `;
  const color: ThemeColor =
    cacheHitRate >= CACHE_HIT_RATE_WARNING_THRESHOLD
      ? "success"
      : cacheHitRate >= CACHE_HIT_RATE_ERROR_THRESHOLD
        ? "warning"
        : "error";
  return theme.fg(color, text);
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
): string {
  const prefix = getFastPrefix(provider);
  const cachePart = buildCacheHitRatePart(theme, cacheHitRate);
  const providerName = `${prefix}${provider ?? "unknown"}`;
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
  provider?: string | undefined,
): string {
  const prefix = getFastPrefix(provider);
  return theme.fg("thinkingMinimal", `${prefix}${modelId ?? "no-model"}`);
}
