import { estimateBurnRate } from "../history";
import type {
  FixedWindowLimit,
  NormalizedLimit,
  RefillableLimit,
  RegenBudgetLimit,
  RiskAssessment,
  Severity,
  ThresholdProfile,
} from "../types";
import { getProfile } from "./profiles";
import {
  getCurrentMonthProjectedPercent,
  getPacePercent,
  getProjectedPercent,
  isRegenSoon,
  postRegenRemaining,
  refillableMinutesToExhaustion,
} from "./projection";

// =============================================================================
// Interpolation helper
// =============================================================================

function interpolate(
  range: { start: number; end: number },
  progress: number,
): number {
  const p = Math.max(0, Math.min(1, progress));
  return range.start + (range.end - range.start) * p;
}

// =============================================================================
// Fixed-window risk
// =============================================================================

function assessFixedWindow(
  limit: FixedWindowLimit,
  profile: ThresholdProfile,
): RiskAssessment {
  const pacePercent = getPacePercent(limit);
  const projectedPercent = getProjectedPercent(limit.usedPercent, pacePercent);
  const progress = pacePercent !== null ? pacePercent / 100 : null;
  const t = profile.fixedWindow;

  const base: RiskAssessment = {
    limitId: limit.id,
    severity: "none",
    projectedPercent,
    pacePercent: pacePercent ?? undefined,
  };

  // At or above 100% used is always critical regardless of projection.
  if (limit.usedPercent >= 100) {
    base.severity = "critical";
    return base;
  }

  if (progress === null) {
    // No pace info: use static thresholds on projected percent.
    if (projectedPercent >= 100) base.severity = "critical";
    else if (projectedPercent >= 90) base.severity = "high";
    else if (projectedPercent >= 80) base.severity = "warning";
    return base;
  }

  // Dynamic thresholds based on window progress.
  const usedFloor = interpolate(t.usedFloor, progress);
  if (limit.usedPercent < usedFloor) return base;

  const criticalThreshold = interpolate(t.criticalProjected, progress);
  const highThreshold = interpolate(t.highProjected, progress);
  const warnThreshold = interpolate(t.warnProjected, progress);

  if (projectedPercent >= criticalThreshold) base.severity = "critical";
  else if (projectedPercent >= highThreshold) base.severity = "high";
  else if (projectedPercent >= warnThreshold) base.severity = "warning";

  return base;
}

// =============================================================================
// Refillable risk
// =============================================================================

async function assessRefillable(
  limit: RefillableLimit,
  profile: ThresholdProfile,
): Promise<RiskAssessment> {
  const t = profile.refillable;
  const remainingPercent = (limit.remaining / limit.capacity) * 100;
  const refillRatePerMin =
    limit.refillAmount / (limit.refillIntervalMs / 60_000);

  const base: RiskAssessment = {
    limitId: limit.id,
    severity: "none",
    refillOffsetsRisk: false,
  };

  // Absolute low remaining check.
  if (remainingPercent <= t.lowRemainingPercent) {
    base.severity = limit.limited ? "critical" : "high";
    base.reason = `${Math.round(remainingPercent)}% remaining`;
    return base;
  }

  // Burn-rate projection.
  const burnRate = await estimateBurnRate(limit.id, refillRatePerMin);
  if (burnRate === null) return base; // Not enough data.

  const netBurn = burnRate - refillRatePerMin;
  if (netBurn <= 0 && t.suppressIfNetBurnNonPositive) {
    base.refillOffsetsRisk = true;
    return base;
  }

  if (netBurn > 0) {
    const minutesToExhaustion = refillableMinutesToExhaustion(limit, burnRate);
    base.minutesToExhaustion = minutesToExhaustion ?? undefined;

    if (minutesToExhaustion !== null) {
      if (minutesToExhaustion <= t.exhaustionHorizonMin * 0.25) {
        base.severity = "critical";
      } else if (minutesToExhaustion <= t.exhaustionHorizonMin * 0.5) {
        base.severity = "high";
      } else if (minutesToExhaustion <= t.exhaustionHorizonMin) {
        base.severity = "warning";
      }
      base.reason = `~${Math.round(minutesToExhaustion)}m to exhaustion`;
    }
  }

  return base;
}

// =============================================================================
// Regen-budget risk
// =============================================================================

function assessBudget(
  limit: RegenBudgetLimit,
  profile: ThresholdProfile,
): RiskAssessment {
  const t = profile.budget;
  const usedPercent =
    ((limit.maxAmountMinor - limit.remainingAmountMinor) /
      limit.maxAmountMinor) *
    100;
  const remaining = limit.remainingAmountMinor;

  const projectedPercent =
    limit.id === "anthropic:extra-usage"
      ? getCurrentMonthProjectedPercent(usedPercent)
      : usedPercent;

  const base: RiskAssessment = {
    limitId: limit.id,
    severity: "none",
    projectedPercent,
  };

  // Determine severity from both percent and absolute thresholds.
  let severityFromPercent: Severity = "none";
  if (usedPercent >= t.criticalPercent) severityFromPercent = "critical";
  else if (usedPercent >= t.warningPercent) severityFromPercent = "warning";

  let severityFromAbsolute: Severity = "none";
  if (remaining <= t.criticalAmountMinor) severityFromAbsolute = "critical";
  else if (remaining <= t.warningAmountMinor) severityFromAbsolute = "warning";

  // Take the higher severity.
  const order: Severity[] = ["none", "warning", "high", "critical"];
  const percentIdx = order.indexOf(severityFromPercent);
  const absoluteIdx = order.indexOf(severityFromAbsolute);
  base.severity = order[Math.max(percentIdx, absoluteIdx)] ?? "none";

  // Downgrade if regen is imminent and post-regen exits the warning zone.
  if (
    base.severity !== "none" &&
    isRegenSoon(limit, t.downgradeIfRegenWithinMin)
  ) {
    const postRegen = postRegenRemaining(limit);
    const postRegenPercent =
      ((limit.maxAmountMinor - postRegen) / limit.maxAmountMinor) * 100;

    if (
      postRegenPercent < t.warningPercent &&
      postRegen > t.warningAmountMinor
    ) {
      // Regen will fix it. Downgrade.
      if (base.severity === "critical") base.severity = "warning";
      else base.severity = "none";
      base.reason = "Replenishing soon";
    }
  }

  return base;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Assesses risk for a single normalized limit.
 */
export async function assessRisk(
  limit: NormalizedLimit,
): Promise<RiskAssessment> {
  const profile = getProfile(
    limit.id,
    "scope" in limit ? limit.scope : undefined,
  );

  switch (limit.kind) {
    case "fixed-window":
      return assessFixedWindow(limit, profile);
    case "refillable":
      return assessRefillable(limit, profile);
    case "regen-budget":
      return assessBudget(limit, profile);
  }
}

/**
 * Assesses risk for all limits and returns only those with non-"none" severity.
 */
export async function findHighRiskLimits(
  limits: NormalizedLimit[],
): Promise<RiskAssessment[]> {
  const results = await Promise.all(limits.map(assessRisk));
  return results.filter((r) => r.severity !== "none");
}

/**
 * Returns the color name for a severity level.
 */
export function getSeverityColor(
  severity: Severity,
): "success" | "warning" | "error" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "warning":
      return "warning";
    default:
      return "success";
  }
}
