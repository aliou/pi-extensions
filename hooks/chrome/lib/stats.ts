import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { formatTokens } from "./utils";

// Context usage thresholds for color coding
export const CONTEXT_WARNING_THRESHOLD = 35;
export const CONTEXT_ERROR_THRESHOLD = 50;

/**
 * Reference context window used to calibrate footer context-pressure colors.
 *
 * When a model's real context window exceeds this, the usage percentage (and
 * therefore the warning/error colors) is computed against this reference
 * rather than the full window. This keeps the color signal firing at the same
 * absolute token counts regardless of how large the model's context window is
 * (e.g. a 1M-context Gemini model still turns warning at ~95k and error at
 * ~136k, matching the previous context-clamp behavior) without mutating the
 * model object or affecting compaction.
 */
export const REFERENCE_CONTEXT_WINDOW = 272_000;

interface CumulativeUsage {
  totalCost: number;
  branchCost: number;
}

interface ContextUsage {
  window: number;
  percent: number;
  display: string;
}

/**
 * Calculate cumulative cost from session entries.
 */
export function getCumulativeUsage(ctx: ExtensionContext): CumulativeUsage {
  let totalCost = 0;
  let branchCost = 0;

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      totalCost += entry.message.usage.cost.total;
    }
  }

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      branchCost += entry.message.usage.cost.total;
    }
  }

  return {
    totalCost,
    branchCost,
  };
}

/**
 * Get context usage from session
 */
export function getContextUsage(
  ctx: ExtensionContext,
): ContextUsage | undefined {
  const contextUsage = ctx.getContextUsage();
  if (!contextUsage) return undefined;

  // Calibrate against the reference window when the model's real window is
  // larger, so colors fire at consistent absolute token counts. See
  // REFERENCE_CONTEXT_WINDOW for rationale.
  const rawWindow = contextUsage.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const referenceWindow =
    rawWindow > REFERENCE_CONTEXT_WINDOW ? REFERENCE_CONTEXT_WINDOW : rawWindow;

  const tokens = contextUsage.tokens;
  const known = tokens !== null && referenceWindow > 0;
  const contextPercentValue = known ? (tokens / referenceWindow) * 100 : 0;
  const contextPercent = known ? contextPercentValue.toFixed(1) : "?";
  const tokensDisplay = tokens !== null ? formatTokens(tokens) : "?";

  return {
    window: referenceWindow,
    percent: contextPercentValue,
    display:
      contextPercent === "?"
        ? `? ?/${formatTokens(referenceWindow)}`
        : `${contextPercent}% ${tokensDisplay}/${formatTokens(referenceWindow)}`,
  };
}

/**
 * Build stats parts for footer line 1 right side.
 */
export function buildStatsParts(
  theme: Theme,
  usage: CumulativeUsage,
  contextUsage: ContextUsage | undefined,
): string[] {
  const costStr =
    Math.abs(usage.branchCost - usage.totalCost) < 0.0005
      ? usage.branchCost === 0
        ? "$0"
        : `$${usage.branchCost.toFixed(3)}`
      : `$${usage.branchCost.toFixed(3)} ($${usage.totalCost.toFixed(3)})`;

  const stats = [costStr, contextUsage?.display].filter(Boolean).join(" ");
  if (!contextUsage) return [stats];

  if (contextUsage.percent > CONTEXT_ERROR_THRESHOLD) {
    return [theme.fg("error", stats)];
  }

  if (contextUsage.percent > CONTEXT_WARNING_THRESHOLD) {
    return [theme.fg("warning", stats)];
  }

  return [stats];
}

/**
 * Build minimal stats for small screens (context used + price only)
 */
export function buildMinimalStatsParts(
  theme: Theme,
  usage: CumulativeUsage,
  contextUsage: ContextUsage | undefined,
): string[] {
  return buildStatsParts(theme, usage, contextUsage);
}
