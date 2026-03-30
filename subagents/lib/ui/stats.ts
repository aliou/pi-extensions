import type { SubagentUsage } from "@subagents/lib/types";

/** Pluralize a word based on count */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Format token count (e.g., "1.2k") */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${tokens}`;
}

/** Format cost with currency suffix (e.g., "0.0023 USD") */
export function formatCost(cost: number, currency: "USD" | "EUR"): string {
  if (cost < 1) return `${cost.toFixed(4)} ${currency}`;
  return `${cost.toFixed(2)} ${currency}`;
}

/**
 * Format subagent stats for display.
 * Shows tokens, tool calls, and cost.
 *
 * Examples:
 * - "1.2k tokens, 3 tools"
 * - "1.2k tokens, 3 tools, $0.02"
 * - "1.2k tokens (est), 3 tools" (when using estimated tokens)
 */
export function formatSubagentStats(
  usage: SubagentUsage,
  toolCallCount: number,
  suffix?: string,
): string {
  const parts: string[] = [];

  // Prefer actual tokens if available, otherwise use estimate
  const hasActualTokens = usage.outputTokens !== undefined;
  const tokenCount = hasActualTokens
    ? (usage.outputTokens ?? 0)
    : usage.estimatedTokens;
  const tokenText = formatTokenCount(tokenCount);
  const estSuffix = hasActualTokens ? "" : " (est)";
  parts.push(`${tokenText} ${pluralize(tokenCount, "token")}${estSuffix}`);

  if (toolCallCount > 0) {
    parts.push(`${toolCallCount} ${pluralize(toolCallCount, "tool")}`);
  }

  if ((usage.totalCostUsd ?? 0) > 0 || (usage.toolCostEur ?? 0) > 0) {
    const costParts: string[] = [];
    if ((usage.totalCostUsd ?? 0) > 0) {
      costParts.push(formatCost(usage.totalCostUsd ?? 0, "USD"));
    }
    if ((usage.toolCostEur ?? 0) > 0) {
      costParts.push(formatCost(usage.toolCostEur ?? 0, "EUR"));
    }
    parts.push(costParts.join(" + "));
  }

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join(", ");
}
