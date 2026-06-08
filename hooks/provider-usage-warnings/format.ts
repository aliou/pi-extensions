import type { NormalizedLimit, RiskAssessment } from "@harness/provider-usage";
import { formatTimeRemaining } from "@harness/utils/formatters";

export interface RiskWithLimit {
  limit: NormalizedLimit;
  risk: RiskAssessment;
}

export function pairRisksWithLimits(
  limits: NormalizedLimit[],
  risks: RiskAssessment[],
): RiskWithLimit[] {
  const limitMap = new Map(limits.map((limit) => [limit.id, limit]));
  return risks
    .map((risk) => {
      const limit = limitMap.get(risk.limitId);
      return limit ? { limit, risk } : null;
    })
    .filter((value): value is RiskWithLimit => value !== null);
}

export function formatProviderUsageWarning(
  displayName: string,
  risks: RiskWithLimit[],
): string {
  const lines = risks.map(({ limit, risk }) => {
    const parts = [
      `- ${limit.scope ? `${limit.name} (${limit.scope})` : limit.name}`,
    ];

    if (limit.kind === "fixed-window") {
      parts.push(`${Math.round(limit.usedPercent)}% used`);
      if (risk.projectedPercent != null) {
        parts.push(`projected ${Math.round(risk.projectedPercent)}%`);
      }
      if (limit.resetsAt) {
        parts.push(`resets ${formatTimeRemaining(limit.resetsAt)}`);
      }
    } else if (limit.kind === "refillable") {
      const pct = Math.round(
        ((limit.capacity - limit.remaining) / limit.capacity) * 100,
      );
      parts.push(`${pct}% used`);
      if (risk.minutesToExhaustion != null) {
        parts.push(`~${Math.round(risk.minutesToExhaustion)}m to exhaustion`);
      }
    } else if (limit.kind === "regen-budget") {
      const pct = Math.round(
        ((limit.maxAmountMinor - limit.remainingAmountMinor) /
          limit.maxAmountMinor) *
          100,
      );
      parts.push(`${pct}% used`);
    }

    if (risk.severity !== "none") parts.push(`(${risk.severity})`);
    return parts.join(", ");
  });

  return `${displayName} rate limit warning:\n${lines.join("\n")}`;
}
