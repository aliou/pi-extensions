import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import { describe, expect, it } from "vitest";
import { normalizeOpenRouterUsage } from "./normalize";
import type { OpenRouterKeyResponse } from "./raw-types";

// Thursday of a week that started Monday 2026-07-13 00:00 UTC; July 2026 has
// 31 days, so a $50 monthly limit interpolates to a 50 * 7 / 31 weekly budget.
const now = new Date("2026-07-16T12:00:00Z");
const ENDPOINT = "https://ai.example.ts.net/v1/connectors/openrouter/key";

function rawKey(
  overrides: Record<string, unknown> = {},
): OpenRouterKeyResponse {
  return {
    data: {
      label: "sk-or-v1-a73...77a",
      limit: 50,
      limit_reset: "monthly",
      limit_remaining: 24.8,
      include_byok_in_limit: false,
      usage: 77.8,
      usage_daily: 0.82,
      usage_weekly: 9.62,
      usage_monthly: 25.2,
      byok_usage: 0,
      byok_usage_daily: 0,
      byok_usage_weekly: 0,
      byok_usage_monthly: 0,
      is_free_tier: false,
      ...overrides,
    },
  } as OpenRouterKeyResponse;
}

function quotaById(snapshot: ProviderUsageSnapshot, id: string): UsageQuota {
  const quota = snapshot.quotas.find((item) => item.id === id);
  if (!quota) throw new Error(`missing quota ${id}`);
  return quota;
}

describe("normalizeOpenRouterUsage", () => {
  it("builds weekly and monthly credit quotas", () => {
    const snapshot = normalizeOpenRouterUsage(rawKey(), now, ENDPOINT);

    expect(snapshot.provider).toBe("openrouter");
    expect(snapshot.displayName).toBe("OpenRouter");
    expect(snapshot.quotas.map((quota) => quota.id)).toEqual([
      "daily",
      "weekly",
      "monthly",
    ]);
  });

  it("interpolates the daily budget from the monthly limit", () => {
    const snapshot = normalizeOpenRouterUsage(rawKey(), now, ENDPOINT);
    const daily = quotaById(snapshot, "daily");

    const expectedBudget = 50 / 31;
    expect(daily.amount.capacity).toBeCloseTo(expectedBudget, 10);
    expect(daily.amount.used).toBe(0.82);
    expect(daily.amount.usedPercent).toBeCloseTo(
      (0.82 / expectedBudget) * 100,
      10,
    );
    expect(daily.period).toMatchObject({
      kind: "calendar",
      label: "daily",
      startsAt: new Date("2026-07-16T00:00:00Z"),
      endsAt: new Date("2026-07-17T00:00:00Z"),
    });
    expect(daily.replenishment).toEqual({
      kind: "full-reset",
      at: new Date("2026-07-17T00:00:00Z"),
    });
  });

  it("interpolates the weekly budget from the monthly limit", () => {
    const snapshot = normalizeOpenRouterUsage(rawKey(), now, ENDPOINT);
    const weekly = quotaById(snapshot, "weekly");

    const expectedBudget = (50 * 7) / 31;
    expect(weekly.amount.capacity).toBeCloseTo(expectedBudget, 10);
    expect(weekly.amount.used).toBe(9.62);
    expect(weekly.amount.usedPercent).toBeCloseTo(
      (9.62 / expectedBudget) * 100,
      10,
    );
  });

  it("scopes the weekly quota to the UTC week starting Monday 00:00", () => {
    const snapshot = normalizeOpenRouterUsage(rawKey(), now, ENDPOINT);
    const weekly = quotaById(snapshot, "weekly");

    expect(weekly.period).toMatchObject({
      kind: "calendar",
      label: "weekly",
      startsAt: new Date("2026-07-13T00:00:00Z"),
      endsAt: new Date("2026-07-20T00:00:00Z"),
    });
    expect(weekly.replenishment).toEqual({
      kind: "full-reset",
      at: new Date("2026-07-20T00:00:00Z"),
    });
  });

  it("scopes the monthly quota to the UTC calendar month with a full reset", () => {
    const snapshot = normalizeOpenRouterUsage(rawKey(), now, ENDPOINT);
    const monthly = quotaById(snapshot, "monthly");

    expect(monthly.period).toMatchObject({
      kind: "calendar",
      label: "monthly",
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: new Date("2026-08-01T00:00:00Z"),
    });
    expect(monthly.amount).toMatchObject({
      capacity: 50,
      used: 25.2,
      remaining: 24.8,
    });
    expect(monthly.amount.usedPercent).toBeCloseTo(50.4, 10);
    expect(monthly.replenishment).toEqual({
      kind: "full-reset",
      at: new Date("2026-08-01T00:00:00Z"),
    });
  });

  it("marks the monthly quota limited when the limit is exhausted", () => {
    const snapshot = normalizeOpenRouterUsage(
      rawKey({ limit_remaining: 0, usage_monthly: 50 }),
      now,
      ENDPOINT,
    );

    expect(quotaById(snapshot, "monthly").state?.limited).toBe(true);
  });

  it("omits quotas when the key has no limit", () => {
    const snapshot = normalizeOpenRouterUsage(
      rawKey({ limit: null, limit_remaining: null }),
      now,
      ENDPOINT,
    );

    expect(snapshot.quotas).toEqual([]);
  });
});
