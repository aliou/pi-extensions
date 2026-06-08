import {
  type NormalizedLimit,
  type ProviderSnapshot,
  writeProviderCache,
} from "@harness/provider-usage";

export const NEURALWATT_QUOTAS_REQUEST_EVENT = "neuralwatt:quotas:request";
export const NEURALWATT_QUOTAS_UPDATED_EVENT = "neuralwatt:quotas:updated";

interface NeuralwattQuotas {
  snapshot_at?: string;
  balance?: {
    credits_remaining_usd?: number;
    total_credits_usd?: number;
  };
  subscription?: {
    plan?: string;
    current_period_end?: string;
    kwh_included?: number;
    kwh_remaining?: number;
  } | null;
  key?: {
    allowance?: {
      limit_usd?: number;
      remaining_usd?: number;
      period?: string;
    } | null;
  };
}

interface NeuralwattQuotasUpdatedPayload {
  quotas?: NeuralwattQuotas;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dollarsToMinor(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100)
    : null;
}

function neuralwattSnapshotFromQuotas(
  quotas: NeuralwattQuotas,
): ProviderSnapshot {
  const updatedAt = parseDate(quotas.snapshot_at) ?? new Date();
  const limits: NormalizedLimit[] = [];

  const totalCredits = dollarsToMinor(quotas.balance?.total_credits_usd);
  const remainingCredits = dollarsToMinor(
    quotas.balance?.credits_remaining_usd,
  );
  if (totalCredits !== null && totalCredits > 0 && remainingCredits !== null) {
    limits.push({
      kind: "regen-budget",
      provider: "neuralwatt",
      id: "neuralwatt:credits",
      name: "Credits",
      currency: "USD",
      maxAmountMinor: totalCredits,
      remainingAmountMinor: Math.max(0, remainingCredits),
      period: "Balance",
      nextRegenAt: null,
      nextRegenAmountMinor: null,
      updatedAt,
    });
  }

  const allowanceLimit = dollarsToMinor(quotas.key?.allowance?.limit_usd);
  const allowanceRemaining = dollarsToMinor(
    quotas.key?.allowance?.remaining_usd,
  );
  if (
    allowanceLimit !== null &&
    allowanceLimit > 0 &&
    allowanceRemaining !== null
  ) {
    limits.push({
      kind: "regen-budget",
      provider: "neuralwatt",
      id: "neuralwatt:key-allowance",
      name: "Key Allowance",
      currency: "USD",
      maxAmountMinor: allowanceLimit,
      remainingAmountMinor: Math.max(0, allowanceRemaining),
      period: quotas.key?.allowance?.period ?? "Allowance",
      nextRegenAt: null,
      nextRegenAmountMinor: null,
      updatedAt,
    });
  }

  const kwhIncluded = quotas.subscription?.kwh_included;
  const kwhRemaining = quotas.subscription?.kwh_remaining;
  if (
    typeof kwhIncluded === "number" &&
    kwhIncluded > 0 &&
    typeof kwhRemaining === "number"
  ) {
    limits.push({
      kind: "fixed-window",
      provider: "neuralwatt",
      id: "neuralwatt:energy",
      name: "Energy",
      scope: quotas.subscription?.plan,
      capacity: kwhIncluded,
      used: Math.max(0, kwhIncluded - kwhRemaining),
      usedPercent: Math.max(
        0,
        Math.min(100, ((kwhIncluded - kwhRemaining) / kwhIncluded) * 100),
      ),
      resetsAt: parseDate(quotas.subscription?.current_period_end),
      unit: "kWh",
      updatedAt,
    });
  }

  return {
    provider: "neuralwatt",
    displayName: "Neuralwatt",
    // Usage events do not carry service health; fetchProvider overlays live status.
    status: "unknown",
    limits,
    plan: quotas.subscription?.plan,
    fetchedAt: updatedAt,
  };
}

export async function updateNeuralwattCache(data: unknown): Promise<void> {
  if (!data || typeof data !== "object") return;
  const { quotas } = data as NeuralwattQuotasUpdatedPayload;
  if (!quotas) return;
  await writeProviderCache("neuralwatt", neuralwattSnapshotFromQuotas(quotas));
}
