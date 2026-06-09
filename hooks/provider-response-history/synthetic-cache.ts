import {
  type NormalizedLimit,
  type ProviderSnapshot,
  writeProviderCache,
} from "@harness/provider-usage";

export const SYNTHETIC_QUOTAS_REQUEST_EVENT = "synthetic:quotas:request";
export const SYNTHETIC_QUOTAS_UPDATED_EVENT = "synthetic:quotas:updated";

interface SyntheticQuotaWindow {
  limit?: number;
  requests?: number;
  renewsAt?: string;
}

interface SyntheticWeeklyTokenLimit {
  nextRegenAt?: string;
  percentRemaining?: number;
  maxCredits?: string;
  remainingCredits?: string;
  nextRegenCredits?: string;
}

interface SyntheticRollingFiveHourLimit {
  nextTickAt?: string;
  tickPercent?: number;
  remaining?: number;
  max?: number;
  limited?: boolean;
}

interface SyntheticQuotas {
  subscription?: SyntheticQuotaWindow;
  search?: { hourly?: SyntheticQuotaWindow };
  freeToolCalls?: SyntheticQuotaWindow;
  weeklyTokenLimit?: SyntheticWeeklyTokenLimit;
  rollingFiveHourLimit?: SyntheticRollingFiveHourLimit;
}

interface SyntheticQuotasUpdatedPayload {
  quotas?: SyntheticQuotas;
  updatedAt?: number;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCurrencyMinor(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function fixedWindowLimit(
  id: string,
  name: string,
  window: SyntheticQuotaWindow | undefined,
  windowSeconds: number,
  updatedAt: Date,
): NormalizedLimit | null {
  if (!window?.limit || window.limit <= 0) return null;
  const used = Math.max(0, window.requests ?? 0);
  return {
    kind: "fixed-window",
    provider: "synthetic",
    id,
    name,
    capacity: window.limit,
    used,
    usedPercent: Math.max(0, Math.min(100, (used / window.limit) * 100)),
    resetsAt: parseDate(window.renewsAt),
    windowSeconds,
    unit: "req",
    updatedAt,
  };
}

function syntheticSnapshotFromQuotas(
  quotas: SyntheticQuotas,
  updatedAt: Date,
): ProviderSnapshot {
  const limits: NormalizedLimit[] = [];

  const weekly = quotas.weeklyTokenLimit;
  const maxCredits = parseCurrencyMinor(weekly?.maxCredits);
  const remainingCredits = parseCurrencyMinor(weekly?.remainingCredits);
  if (weekly && maxCredits !== null && maxCredits > 0) {
    limits.push({
      kind: "regen-budget",
      provider: "synthetic",
      id: "synthetic:weekly-credits",
      name: "Credits / week",
      currency: "USD",
      maxAmountMinor: maxCredits,
      remainingAmountMinor:
        remainingCredits ??
        Math.max(
          0,
          Math.round(maxCredits * ((weekly.percentRemaining ?? 0) / 100)),
        ),
      period: "Weekly",
      nextRegenAt: parseDate(weekly.nextRegenAt),
      nextRegenAmountMinor: parseCurrencyMinor(weekly.nextRegenCredits),
      updatedAt,
    });
  }

  const rolling = quotas.rollingFiveHourLimit;
  if (rolling?.max && rolling.max > 0) {
    // tickPercent may be a fraction (0–1) or a percentage (0–100). Normalize.
    const rawTickPercent = rolling.tickPercent ?? 0;
    const tickFraction =
      typeof rawTickPercent === "number" && Number.isFinite(rawTickPercent)
        ? rawTickPercent > 1
          ? rawTickPercent / 100
          : rawTickPercent
        : 0;
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    limits.push({
      kind: "refillable",
      provider: "synthetic",
      id: "synthetic:rolling-five-hour",
      name: "Requests / 5h",
      capacity: rolling.max,
      remaining: Math.max(0, rolling.remaining ?? rolling.max),
      refillAmount: Math.max(0, tickFraction * rolling.max),
      refillIntervalMs:
        tickFraction > 0
          ? Math.min(FIVE_HOURS_MS, FIVE_HOURS_MS * tickFraction)
          : FIVE_HOURS_MS,
      nextRefillAt: parseDate(rolling.nextTickAt) ?? updatedAt,
      limited: rolling.limited ?? false,
      updatedAt,
    });
  }

  // Note: quotas.subscription is intentionally excluded. It duplicates the
  // rolling 5h limit and pi-synthetic's own UI does not display it.
  for (const limit of [
    fixedWindowLimit(
      "synthetic:search-hourly",
      "Search / hour",
      quotas.search?.hourly,
      60 * 60,
      updatedAt,
    ),
    fixedWindowLimit(
      "synthetic:free-tool-calls",
      "Free Tool Calls / day",
      quotas.freeToolCalls,
      24 * 60 * 60,
      updatedAt,
    ),
  ]) {
    if (limit) limits.push(limit);
  }

  return {
    provider: "synthetic",
    displayName: "Synthetic",
    // Usage events do not carry service health; fetchProvider overlays live status.
    status: "unknown",
    limits,
    fetchedAt: updatedAt,
  };
}

export async function updateSyntheticCache(data: unknown): Promise<void> {
  if (!data || typeof data !== "object") return;
  const { quotas, updatedAt } = data as SyntheticQuotasUpdatedPayload;
  if (!quotas) return;
  const fetchedAt =
    typeof updatedAt === "number" ? new Date(updatedAt) : new Date();
  await writeProviderCache(
    "synthetic",
    syntheticSnapshotFromQuotas(quotas, fetchedAt),
  );
}
