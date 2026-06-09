import type { ThresholdProfile } from "../types";

/** Default profile for most providers/windows. */
const DEFAULT_PROFILE: ThresholdProfile = {
  fixedWindow: {
    usedFloor: { start: 33, end: 8 },
    warnProjected: { start: 260, end: 120 },
    highProjected: { start: 320, end: 145 },
    criticalProjected: { start: 400, end: 170 },
  },
  refillable: {
    lowRemainingPercent: 5,
    exhaustionHorizonMin: 60,
    suppressIfNetBurnNonPositive: true,
  },
  budget: {
    warningPercent: 80,
    criticalPercent: 90,
    warningAmountMinor: 1000, // $10
    criticalAmountMinor: 500, // $5
    downgradeIfRegenWithinMin: 15,
  },
};

/**
 * Stricter profile for scarce per-model limits (e.g. Codex Spark).
 * Lower thresholds so warnings fire earlier.
 */
const STRICT_PROFILE: ThresholdProfile = {
  fixedWindow: {
    usedFloor: { start: 20, end: 5 },
    warnProjected: { start: 180, end: 100 },
    highProjected: { start: 240, end: 120 },
    criticalProjected: { start: 300, end: 140 },
  },
  refillable: DEFAULT_PROFILE.refillable,
  budget: DEFAULT_PROFILE.budget,
};

/** Profile for NeuralWatt monthly energy — exhausting is costly so warn earlier. */
const NEURALWATT_PROFILE: ThresholdProfile = {
  fixedWindow: {
    usedFloor: { start: 15, end: 5 },
    warnProjected: { start: 150, end: 100 },
    highProjected: { start: 190, end: 115 },
    criticalProjected: { start: 240, end: 130 },
  },
  refillable: DEFAULT_PROFILE.refillable,
  budget: DEFAULT_PROFILE.budget,
};

/**
 * Returns the threshold profile for a given limit.
 * Uses limit ID and scope to select appropriate thresholds.
 */
export function getProfile(_limitId: string, scope?: string): ThresholdProfile {
  // NeuralWatt energy — monthly billing, exhausting is costly.
  if (_limitId === "neuralwatt:energy") return NEURALWATT_PROFILE;

  // Codex Spark and similar per-model limits get stricter thresholds.
  if (scope) {
    const lower = scope.toLowerCase();
    if (lower.includes("spark")) {
      return STRICT_PROFILE;
    }
  }

  return DEFAULT_PROFILE;
}
