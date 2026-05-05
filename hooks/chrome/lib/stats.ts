import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { formatTokens } from "./utils";

// Context usage thresholds for color coding
export const CONTEXT_WARNING_THRESHOLD = 35;
export const CONTEXT_ERROR_THRESHOLD = 50;

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

  const contextWindow =
    contextUsage.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const contextPercentValue = contextUsage?.percent ?? 0;
  const contextPercent =
    contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

  return {
    window: contextWindow,
    percent: contextPercentValue,
    display:
      contextPercent === "?"
        ? `?/${formatTokens(contextWindow)}`
        : `${contextPercent}%/${formatTokens(contextWindow)}`,
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
