import {
  type NormalizedLimit,
  type ProviderSnapshot,
  writeProviderCache,
} from "@harness/provider-usage";

export const NEURALWATT_QUOTAS_REQUEST_EVENT = "neuralwatt:quotas:request";
export const NEURALWATT_QUOTAS_UPDATED_EVENT = "neuralwatt:quotas:updated";

interface NeuralwattQuotas {
  snapshot_at?: string;
  subscription?: {
    plan?: string;
    current_period_start?: string;
    current_period_end?: string;
    kwh_included?: number;
    kwh_used?: number;
    kwh_remaining?: number;
    in_overage?: boolean;
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

  // 1. Energy (subscription) — primary metric when present.
  const kwhIncluded = quotas.subscription?.kwh_included;
  const kwhUsed = quotas.subscription?.kwh_used;
  const kwhRemaining = quotas.subscription?.kwh_remaining;
  const inOverage = quotas.subscription?.in_overage;
  const periodEnd = parseDate(quotas.subscription?.current_period_end);
  const periodStart = parseDate(quotas.subscription?.current_period_start);
  // Compute billing window duration for pace-based projection.
  const windowSeconds =
    periodStart && periodEnd && periodEnd.getTime() > periodStart.getTime()
      ? Math.round((periodEnd.getTime() - periodStart.getTime()) / 1000)
      : undefined;
  if (
    typeof kwhIncluded === "number" &&
    kwhIncluded > 0 &&
    (typeof kwhUsed === "number" || typeof kwhRemaining === "number")
  ) {
    // Prefer kwh_used (charged basis) from the API; fall back to computed.
    const used =
      typeof kwhUsed === "number"
        ? kwhUsed
        : Math.max(0, kwhIncluded - (kwhRemaining ?? 0));
    limits.push({
      kind: "fixed-window",
      provider: "neuralwatt",
      id: "neuralwatt:energy",
      name: "Energy",
      scope: quotas.subscription?.plan,
      capacity: kwhIncluded,
      used,
      usedPercent: Math.max(0, Math.min(100, (used / kwhIncluded) * 100)),
      resetsAt: periodEnd,
      windowSeconds,
      unit: "kWh",
      updatedAt,
    });
  }

  // 2. Key Allowance — API-key-scoped budget.
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

  return {
    provider: "neuralwatt",
    displayName: "Neuralwatt",
    // Usage events do not carry service health; fetchProvider overlays live status.
    status: "unknown",
    limits,
    plan: quotas.subscription?.plan,
    extraUsageActive: inOverage === true,
    fetchedAt: updatedAt,
  };
}

export async function updateNeuralwattCache(data: unknown): Promise<void> {
  if (!data || typeof data !== "object") return;
  const { quotas } = data as NeuralwattQuotasUpdatedPayload;
  if (!quotas) return;
  await writeProviderCache("neuralwatt", neuralwattSnapshotFromQuotas(quotas));
}
