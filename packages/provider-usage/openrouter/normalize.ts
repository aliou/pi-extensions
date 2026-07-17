import type {
  ProviderUsageSnapshot,
  UsageQuota,
  UsageSource,
} from "../core/index";
import type { OpenRouterKeyResponse } from "./raw-types";

const PROVIDER = "openrouter" as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function normalizeOpenRouterUsage(
  raw: OpenRouterKeyResponse,
  fetchedAt: Date,
  endpoint: string,
): ProviderUsageSnapshot {
  const source: UsageSource = { kind: "api", endpoint, fetchedAt };
  const { data } = raw;
  const quotas: UsageQuota[] = [];
  const { limit, limit_remaining: remaining } = data;

  // OpenRouter keys have a single limit scoped to the reset period (monthly
  // for our keys); there are no native daily/weekly limits. Those bars'
  // budgets are interpolated from that limit so each period gets its prorated
  // share: `limit * period / days-in-month`. Days reset 00:00 UTC, weeks reset
  // Monday 00:00 UTC.
  if (limit != null && limit > 0) {
    const month = {
      start: monthStart(fetchedAt),
      end: nextMonthStart(fetchedAt),
    };
    const monthMs = month.end.getTime() - month.start.getTime();

    const dayStart = utcMidnight(fetchedAt);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const dailyBudget = (limit * DAY_MS) / monthMs;
    quotas.push({
      provider: PROVIDER,
      id: "daily",
      name: "Credits / day",
      role: "primary",
      updatedAt: fetchedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: percentUsed(data.usage_daily, dailyBudget),
        capacity: dailyBudget,
        used: data.usage_daily,
        remaining: Math.max(0, dailyBudget - data.usage_daily),
      },
      period: {
        kind: "calendar",
        label: "daily",
        startsAt: dayStart,
        endsAt: dayEnd,
      },
      depletion: { kind: "monotonic" },
      replenishment: { kind: "full-reset", at: dayEnd },
      source,
      raw: data,
    });

    const weekStart = mondayStart(fetchedAt);
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const weeklyBudget = (limit * WEEK_MS) / monthMs;
    quotas.push({
      provider: PROVIDER,
      id: "weekly",
      name: "Credits / week",
      role: "secondary",
      updatedAt: fetchedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: percentUsed(data.usage_weekly, weeklyBudget),
        capacity: weeklyBudget,
        used: data.usage_weekly,
        remaining: Math.max(0, weeklyBudget - data.usage_weekly),
      },
      period: {
        kind: "calendar",
        label: "weekly",
        startsAt: weekStart,
        endsAt: weekEnd,
      },
      depletion: { kind: "monotonic" },
      replenishment: { kind: "full-reset", at: weekEnd },
      source,
      raw: data,
    });

    // The limit does not refill during the reset period: it only resets
    // wholesale at the start of the next one.
    quotas.push({
      provider: PROVIDER,
      id: "monthly",
      name: "Credits / month",
      role: "budget",
      updatedAt: fetchedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: percentUsed(data.usage_monthly, limit),
        capacity: limit,
        used: data.usage_monthly,
        remaining: remaining ?? Math.max(0, limit - data.usage_monthly),
      },
      period: {
        kind: "calendar",
        label: "monthly",
        startsAt: month.start,
        endsAt: month.end,
      },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "full-reset", at: month.end },
      state:
        remaining != null && remaining <= 0 ? { limited: true } : undefined,
      source,
      raw: data,
    });
  }

  return {
    provider: PROVIDER,
    displayName: "OpenRouter",
    fetchedAt,
    status: { available: true },
    account: { id: data.label },
    quotas,
    source,
    raw,
  };
}

/** Monday 00:00 UTC of the week containing `date`. */
function mondayStart(date: Date): Date {
  const midnight = utcMidnight(date);
  const sinceMonday = (midnight.getUTCDay() + 6) % 7;
  return new Date(midnight.getTime() - sinceMonday * DAY_MS);
}

/** 00:00 UTC of the day containing `date`. */
function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function percentUsed(used: number, capacity: number): number {
  return capacity <= 0 ? 0 : (used / capacity) * 100;
}
