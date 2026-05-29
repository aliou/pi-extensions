import type {
  FixedWindowLimit,
  RefillableLimit,
  RegenBudgetLimit,
} from "@harness/provider-usage";

const MIN_PACE_PERCENT = 5;

// =============================================================================
// Fixed-window projection (pace-based)
// =============================================================================

/**
 * Returns how far through the window we are (0-100), based on resetsAt and
 * windowSeconds. Returns null if either is missing.
 */
export function getPacePercent(limit: FixedWindowLimit): number | null {
  if (!limit.windowSeconds || !limit.resetsAt) return null;
  const totalMs = limit.windowSeconds * 1000;
  if (!Number.isFinite(totalMs) || totalMs <= 0) return null;
  const remainingMs = limit.resetsAt.getTime() - Date.now();
  const elapsedMs = totalMs - remainingMs;
  return Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
}

/**
 * Projects end-of-window usage assuming linear consumption rate.
 */
export function getProjectedPercent(
  usedPercent: number,
  pacePercent: number | null,
): number {
  if (pacePercent === null) return usedPercent;
  const effective = Math.max(MIN_PACE_PERCENT, pacePercent);
  return Math.max(0, (usedPercent / effective) * 100);
}

// =============================================================================
// Refillable projection (net-burn with discrete tick simulation)
// =============================================================================

/**
 * Simulates remaining capacity over a time horizon, accounting for discrete
 * refill ticks. Returns projected remaining at the end of the horizon.
 *
 * @param remaining - Current remaining capacity.
 * @param burnRatePerMin - Consumption rate per minute (estimated from history).
 * @param now - Current time in epoch ms.
 * @param horizonMin - How far ahead to project, in minutes.
 * @param nextRefillAt - Epoch ms of the next refill tick.
 * @param refillIntervalMs - Interval between ticks.
 * @param refillAmount - Amount refilled per tick.
 * @param capacity - Maximum capacity (refill caps here).
 */
export function projectRefillableRemaining(
  remaining: number,
  burnRatePerMin: number,
  now: number,
  horizonMin: number,
  nextRefillAt: number,
  refillIntervalMs: number,
  refillAmount: number,
  capacity: number,
): number {
  let t = now;
  let rem = remaining;
  const end = now + horizonMin * 60_000;
  let next = nextRefillAt;

  // Fast-forward past any stale next-refill timestamps.
  while (next <= t && refillIntervalMs > 0) {
    next += refillIntervalMs;
  }

  // Simulate tick-by-tick.
  const maxIterations = 1000;
  let iterations = 0;
  while (t < end && iterations < maxIterations) {
    iterations++;
    const nextEvent = Math.min(end, next);
    const dtMin = (nextEvent - t) / 60_000;
    rem -= burnRatePerMin * dtMin;

    if (rem <= 0) return 0;

    if (nextEvent === next && refillIntervalMs > 0) {
      rem = Math.min(capacity, rem + refillAmount);
      next += refillIntervalMs;
    }
    t = nextEvent;
  }

  return Math.max(0, rem);
}

/**
 * Estimates minutes until exhaustion for a refillable limit.
 * Returns null if net burn rate <= 0 (will never exhaust).
 */
export function refillableMinutesToExhaustion(
  limit: RefillableLimit,
  burnRatePerMin: number,
): number | null {
  const refillRatePerMin =
    limit.refillAmount / (limit.refillIntervalMs / 60_000);
  const netBurn = burnRatePerMin - refillRatePerMin;
  if (netBurn <= 0) return null; // Refill outpaces consumption.
  return limit.remaining / netBurn;
}

// =============================================================================
// Regen-budget projection
// =============================================================================

/**
 * For a regen-budget limit, computes what remaining will be right after
 * the next regen event fires (if it fires within the horizon).
 */
export function postRegenRemaining(limit: RegenBudgetLimit): number {
  if (!limit.nextRegenAmountMinor) return limit.remainingAmountMinor;
  return Math.min(
    limit.maxAmountMinor,
    limit.remainingAmountMinor + limit.nextRegenAmountMinor,
  );
}

/**
 * Returns true if the next regen event is within the given number of minutes.
 */
export function isRegenSoon(
  limit: RegenBudgetLimit,
  withinMin: number,
): boolean {
  if (!limit.nextRegenAt) return false;
  const msUntilRegen = limit.nextRegenAt.getTime() - Date.now();
  return msUntilRegen > 0 && msUntilRegen <= withinMin * 60_000;
}
