import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import { describe, expect, it } from "vitest";
import { normalizeNeuralwattUsage } from "./normalize";
import type { NeuralwattQuotaResponse } from "./raw-types";

const fetchedAt = new Date("2026-07-22T12:00:00Z");
const ENDPOINT =
  "http://ai.tetra-albacore.ts.net/v1/connectors/neuralwatt/v1/quota";

function rawResponse(
  overrides: Record<string, unknown> = {},
): NeuralwattQuotaResponse {
  return {
    snapshot_at: "2026-07-22T12:00:00Z",
    balance: {
      credits_remaining_usd: 35.8,
      total_credits_usd: 35.8,
      credits_used_usd: 0,
      accounting_method: "energy",
    },
    usage: {
      lifetime: {
        cost_usd: 698.96,
        requests: 73578,
        tokens: 3697902536,
        energy_kwh: 35.59,
      },
      current_month: {
        cost_usd: 61.37,
        requests: 18955,
        tokens: 888783310,
        energy_kwh: 11.11,
      },
    },
    limits: {
      overage_limit_usd: 10,
      rate_limit_tier: "standard",
    },
    subscription: {
      plan: "standard",
      status: "active",
      billing_interval: "month",
      current_period_start: "2026-06-25T12:04:16Z",
      current_period_end: "2026-07-25T12:04:16Z",
      auto_renew: true,
      kwh_included: 16,
      kwh_used: 16.0161,
      kwh_remaining: 0,
      in_overage: true,
      kwh_reset_date: "2026-07-25T12:04:16Z",
    },
    key: {
      name: "Tailscale Aperture",
      allowance: null,
    },
    ...overrides,
  } as NeuralwattQuotaResponse;
}

function quotaById(snapshot: ProviderUsageSnapshot, id: string): UsageQuota {
  const quota = snapshot.quotas.find((item) => item.id === id);
  if (!quota) throw new Error(`missing quota ${id}`);
  return quota;
}

describe("normalizeNeuralwattUsage", () => {
  it("keeps the subscription energy quota unchanged", () => {
    const snapshot = normalizeNeuralwattUsage(
      rawResponse(),
      fetchedAt,
      ENDPOINT,
    );
    const sub = quotaById(snapshot, "subscription");

    expect(sub.amount).toMatchObject({
      capacity: 16,
      used: 16.0161,
      remaining: 0,
    });
    expect(sub.amount.usedPercent).toBeCloseTo(100.1, 1);
    expect(sub.state?.overage).toBe(true);
  });

  it("computes the overage quota from kWh beyond subscription at $5/kWh", () => {
    const snapshot = normalizeNeuralwattUsage(
      rawResponse(),
      fetchedAt,
      ENDPOINT,
    );
    const overage = quotaById(snapshot, "limits.overage_limit_usd");

    expect(overage.amount.capacity).toBe(10);
    expect(overage.amount.used).toBeCloseTo(0.0805, 4);
    expect(overage.amount.remaining).toBeCloseTo(9.9195, 4);
    expect(overage.amount.usedPercent).toBeCloseTo(0.805, 2);
    expect(overage.state?.overage).toBe(true);
  });

  it("shows zero overage when usage is within subscription allowance", () => {
    const snapshot = normalizeNeuralwattUsage(
      rawResponse({
        subscription: {
          ...rawResponse().subscription,
          kwh_used: 10,
          kwh_remaining: 6,
          in_overage: false,
        },
      }),
      fetchedAt,
      ENDPOINT,
    );
    const overage = quotaById(snapshot, "limits.overage_limit_usd");

    expect(overage.amount.used).toBe(0);
    expect(overage.amount.remaining).toBe(10);
    expect(overage.amount.usedPercent).toBe(0);
    expect(overage.state?.overage).toBe(false);
  });

  it("caps used kWh at zero when subscription usage is somehow below included", () => {
    const snapshot = normalizeNeuralwattUsage(
      rawResponse({
        subscription: {
          ...rawResponse().subscription,
          kwh_used: 12,
          kwh_included: 16,
          kwh_remaining: 4,
          in_overage: false,
        },
      }),
      fetchedAt,
      ENDPOINT,
    );
    const overage = quotaById(snapshot, "limits.overage_limit_usd");

    expect(overage.amount.used).toBe(0);
    expect(overage.amount.usedPercent).toBe(0);
  });
});
