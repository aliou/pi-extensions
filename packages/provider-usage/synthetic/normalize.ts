import type {
  ProviderUsageSnapshot,
  UsageQuota,
  UsageSource,
} from "../core/index";
import type { SyntheticLimit, SyntheticQuotasResponse } from "./raw-types";

const PROVIDER = "synthetic" as const;
const ENDPOINT = "https://api.synthetic.new/v2/quotas";

export function normalizeSyntheticUsage(
  raw: SyntheticQuotasResponse,
  fetchedAt: Date,
): ProviderUsageSnapshot {
  const source: UsageSource = { kind: "api", endpoint: ENDPOINT, fetchedAt };
  const quotas: UsageQuota[] = [];

  if (raw.weeklyTokenLimit) {
    const capacity = money(raw.weeklyTokenLimit.maxCredits);
    const remaining = money(raw.weeklyTokenLimit.remainingCredits);
    const amount = money(raw.weeklyTokenLimit.nextRegenCredits);
    quotas.push({
      provider: PROVIDER,
      id: "weeklyTokenLimit",
      name: "Credits / week",
      role: "primary",
      updatedAt: fetchedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: 100 - raw.weeklyTokenLimit.percentRemaining,
        capacity,
        remaining,
        used:
          capacity == null || remaining == null
            ? undefined
            : capacity - remaining,
      },
      period: {
        kind: "rolling",
        label: "weekly",
        durationMs: 7 * 24 * 60 * 60 * 1000,
      },
      depletion: { kind: "remaining-balance" },
      replenishment: {
        kind: "scheduled",
        amount,
        at: new Date(raw.weeklyTokenLimit.nextRegenAt),
        cap: capacity,
      },
      source,
      raw: raw.weeklyTokenLimit,
    });
  }

  if (raw.rollingFiveHourLimit) {
    quotas.push({
      provider: PROVIDER,
      id: "rollingFiveHourLimit",
      name: "Requests / 5h",
      role: "secondary",
      updatedAt: fetchedAt,
      metric: { kind: "count", unit: "request" },
      amount: {
        usedPercent: percentUsed(
          raw.rollingFiveHourLimit.max - raw.rollingFiveHourLimit.remaining,
          raw.rollingFiveHourLimit.max,
        ),
        capacity: raw.rollingFiveHourLimit.max,
        used: raw.rollingFiveHourLimit.max - raw.rollingFiveHourLimit.remaining,
        remaining: raw.rollingFiveHourLimit.remaining,
      },
      period: {
        kind: "rolling",
        label: "5 hour",
        durationMs: 5 * 60 * 60 * 1000,
        startsAt: new Date(fetchedAt.getTime() - 5 * 60 * 60 * 1000),
        endsAt: fetchedAt,
      },
      depletion: { kind: "offset-burn" },
      replenishment: {
        kind: "discrete-tick",
        amount:
          raw.rollingFiveHourLimit.max * raw.rollingFiveHourLimit.tickPercent,
        intervalMs: 60_000,
        nextAt: new Date(raw.rollingFiveHourLimit.nextTickAt),
        cap: raw.rollingFiveHourLimit.max,
      },
      state: { limited: raw.rollingFiveHourLimit.limited },
      source,
      raw: raw.rollingFiveHourLimit,
    });
  }

  addFixed(
    quotas,
    "search.hourly",
    "Search / hour",
    raw.search?.hourly,
    "request",
    "hourly",
    source,
    fetchedAt,
  );
  return {
    provider: PROVIDER,
    displayName: "Synthetic",
    fetchedAt,
    status: { available: true },
    quotas,
    source,
    raw,
  };
}

function addFixed(
  quotas: UsageQuota[],
  id: string,
  name: string,
  limit: SyntheticLimit | null | undefined,
  unit: string,
  label: string,
  source: UsageSource,
  fetchedAt: Date,
): void {
  if (!limit) return;
  quotas.push({
    provider: PROVIDER,
    id,
    name,
    role: "ancillary",
    updatedAt: fetchedAt,
    metric: { kind: "count", unit },
    amount: {
      usedPercent: percentUsed(limit.requests, limit.limit),
      capacity: limit.limit,
      used: limit.requests,
      remaining: Math.max(0, limit.limit - limit.requests),
    },
    period: {
      kind: "calendar",
      label,
      durationMs: label === "hourly" ? 60 * 60 * 1000 : undefined,
      startsAt:
        label === "hourly"
          ? new Date(new Date(limit.renewsAt).getTime() - 60 * 60 * 1000)
          : undefined,
      endsAt: new Date(limit.renewsAt),
    },
    depletion: { kind: "monotonic" },
    replenishment: { kind: "full-reset", at: new Date(limit.renewsAt) },
    source,
    raw: limit,
  });
}

function percentUsed(used: number, capacity: number): number {
  return capacity <= 0 ? 0 : (used / capacity) * 100;
}

function money(value: string): number | undefined {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
