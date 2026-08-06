import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

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
 * Build model line for footer line 2 right side
 */
export function buildModelLine(
  theme: Theme,
  provider: string | undefined,
  modelId: string | undefined,
  hasReasoning: boolean,
  thinkingLevel: string,
): string {
  const providerName = provider ?? "unknown";
  const modelPart = `${providerName}/${modelId ?? "no-model"}:`;

  if (hasReasoning) {
    const formattedLevel =
      thinkingLevel !== "off"
        ? thinkingLevel.slice(0, 3) // min, med, max
        : "off";
    const thinkingColorToken = thinkingLevelToColorToken(thinkingLevel);
    return (
      theme.fg("thinkingMinimal", modelPart) +
      theme.fg(thinkingColorToken, formattedLevel)
    );
  }

  return (
    theme.fg("thinkingMinimal", modelPart) + theme.fg("thinkingOff", "none")
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
