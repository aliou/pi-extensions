import type {
  ProviderUsageSnapshot,
  UsageQuota,
  UsageSource,
} from "../core/index";
import type { NeuralwattQuotaResponse } from "./raw-types";

const PROVIDER = "neuralwatt" as const;

export function normalizeNeuralwattUsage(
  raw: NeuralwattQuotaResponse,
  fetchedAt: Date,
  endpoint: string,
): ProviderUsageSnapshot {
  const source: UsageSource = { kind: "api", endpoint, fetchedAt };
  const updatedAt = raw.snapshot_at ? new Date(raw.snapshot_at) : fetchedAt;
  const quotas: UsageQuota[] = [];

  if (raw.subscription) {
    quotas.push({
      provider: PROVIDER,
      id: "subscription",
      name: `${raw.subscription.plan} subscription energy`,
      role: "primary",
      updatedAt,
      metric: { kind: "energy", unit: "kWh" },
      amount: {
        usedPercent: percentUsed(
          raw.subscription.kwh_used,
          raw.subscription.kwh_included,
        ),
        capacity: raw.subscription.kwh_included,
        used: raw.subscription.kwh_used,
        remaining: raw.subscription.kwh_remaining,
      },
      period: {
        kind: "billing",
        label: raw.subscription.billing_interval,
        startsAt: new Date(raw.subscription.current_period_start),
        endsAt: new Date(raw.subscription.current_period_end),
      },
      depletion: { kind: "monotonic" },
      replenishment: {
        kind: "full-reset",
        at: new Date(raw.subscription.kwh_reset_date),
      },
      state: { overage: raw.subscription.in_overage },
      source,
      raw: raw.subscription,
    });
  }

  if (raw.balance) {
    quotas.push({
      provider: PROVIDER,
      id: "balance",
      name: "Credit balance",
      role: "budget",
      updatedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: percentUsed(
          raw.balance.credits_used_usd,
          raw.balance.total_credits_usd,
        ),
        capacity: raw.balance.total_credits_usd,
        used: raw.balance.credits_used_usd,
        remaining: raw.balance.credits_remaining_usd,
      },
      period: {
        kind: "allowance",
        label: raw.balance.accounting_method ?? "credits",
      },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "none" },
      source,
      raw: raw.balance,
    });
  }

  if (raw.key?.allowance) {
    quotas.push({
      provider: PROVIDER,
      id: "key.allowance",
      name: raw.key.name ? `${raw.key.name} key allowance` : "Key allowance",
      scope: raw.key.name ?? undefined,
      role: "allowance",
      updatedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: percentUsed(
          raw.key.allowance.used_usd,
          raw.key.allowance.limit_usd,
        ),
        capacity: raw.key.allowance.limit_usd,
        used: raw.key.allowance.used_usd,
        remaining: raw.key.allowance.remaining_usd,
      },
      period: { kind: "allowance", label: "key" },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "none" },
      source,
      raw: raw.key.allowance,
    });
  }

  if (raw.limits?.overage_limit_usd != null) {
    quotas.push({
      provider: PROVIDER,
      id: "limits.overage_limit_usd",
      name: "Overage limit",
      role: "secondary",
      updatedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: 0,
        capacity: raw.limits.overage_limit_usd,
        remaining: raw.limits.overage_limit_usd,
      },
      period: { kind: "billing", label: "overage" },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "none" },
      source,
      raw: raw.limits,
    });
  }

  return {
    provider: PROVIDER,
    displayName: "Neuralwatt",
    fetchedAt,
    status: {
      available: raw.subscription?.status === "active",
      limited: raw.subscription?.in_overage,
      plan: raw.subscription?.plan,
    },
    quotas,
    source,
    raw,
  };
}

function percentUsed(used: number, capacity: number): number {
  return capacity <= 0 ? 0 : (used / capacity) * 100;
}
