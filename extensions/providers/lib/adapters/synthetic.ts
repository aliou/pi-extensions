import type { AuthStorage } from "@mariozechner/pi-coding-agent";
import type {
  FixedWindowLimit,
  NormalizedLimit,
  ProviderSnapshot,
  RefillableLimit,
  RegenBudgetLimit,
} from "../types";
import type { ProviderAdapter } from "./base";

const API_URL = "https://api.synthetic.new/v2/quotas";

// --- Raw API response types ---

interface RawSearchHourly {
  limit?: number;
  requests?: number;
  renewsAt?: string;
}

interface RawRollingFiveHour {
  max?: number;
  remaining?: number;
  tickPercent?: number;
  nextTickAt?: string;
  limited?: boolean;
}

interface RawWeeklyTokenLimit {
  percentRemaining?: number;
  maxCredits?: string;
  remainingCredits?: string;
  nextRegenCredits?: string;
  nextRegenAt?: string;
}

interface RawQuotasResponse {
  search?: { hourly?: RawSearchHourly };
  rollingFiveHourLimit?: RawRollingFiveHour;
  weeklyTokenLimit?: RawWeeklyTokenLimit;
}

// --- Helpers ---

function parseISO8601(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDollars(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,]/g, "").trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

// --- Normalizers ---

function buildSearchHourly(
  raw: RawSearchHourly | undefined,
  now: Date,
): FixedWindowLimit | null {
  if (!raw?.limit || raw.limit <= 0) return null;
  const used = raw.requests ?? 0;
  return {
    kind: "fixed-window",
    provider: "synthetic",
    id: "synthetic:search-hourly",
    name: "Search (1h)",
    capacity: raw.limit,
    used,
    usedPercent: (used / raw.limit) * 100,
    resetsAt: parseISO8601(raw.renewsAt),
    windowSeconds: 60 * 60,
    unit: "req",
    updatedAt: now,
  };
}

function buildRollingFiveHour(
  raw: RawRollingFiveHour | undefined,
  now: Date,
): RefillableLimit | null {
  if (!raw?.max || raw.max <= 0) return null;
  const remaining = raw.remaining ?? raw.max;
  const tickPercent = raw.tickPercent ?? 0.05;
  const refillAmount = raw.max * tickPercent;

  // Tick interval: window duration (5h) * tickPercent.
  // 20 ticks in 5h = 15 min each. Formula: 5h_ms * tickPercent.
  const refillIntervalMs = 5 * 60 * 60 * 1000 * tickPercent;

  return {
    kind: "refillable",
    provider: "synthetic",
    id: "synthetic:rolling-five-hour",
    name: "5h window",
    capacity: raw.max,
    remaining,
    refillAmount,
    refillIntervalMs,
    nextRefillAt:
      parseISO8601(raw.nextTickAt) ??
      new Date(now.getTime() + refillIntervalMs),
    limited: raw.limited ?? false,
    updatedAt: now,
  };
}

function buildWeeklyTokenLimit(
  raw: RawWeeklyTokenLimit | undefined,
  now: Date,
): RegenBudgetLimit | null {
  if (!raw) return null;
  const maxDollars = parseDollars(raw.maxCredits);
  const remainingDollars = parseDollars(raw.remainingCredits);
  if (maxDollars === null || remainingDollars === null) return null;

  const maxMinor = Math.round(maxDollars * 100);
  const remainingMinor = Math.round(remainingDollars * 100);
  const regenDollars = parseDollars(raw.nextRegenCredits);
  const regenMinor =
    regenDollars !== null ? Math.round(regenDollars * 100) : null;

  return {
    kind: "regen-budget",
    provider: "synthetic",
    id: "synthetic:weekly-credits",
    name: "7d credits",
    currency: "USD",
    maxAmountMinor: maxMinor,
    remainingAmountMinor: remainingMinor,
    period: "Weekly",
    nextRegenAt: parseISO8601(raw.nextRegenAt),
    nextRegenAmountMinor: regenMinor,
    updatedAt: now,
  };
}

// --- Adapter ---

export const syntheticAdapter: ProviderAdapter = {
  provider: "synthetic",

  async fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot> {
    const now = new Date();
    const token = await authStorage.getApiKey("synthetic");

    if (!token) {
      return {
        provider: "synthetic",
        displayName: "Synthetic",
        status: "unknown",
        limits: [],
        error: "Not configured",
        fetchedAt: now,
      };
    }

    const combined = timeoutSignal(8000, signal);

    try {
      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: combined,
      });

      if (!res.ok) {
        const errMsg =
          res.status === 401 || res.status === 403
            ? "Invalid API key"
            : `HTTP ${res.status}`;
        return {
          provider: "synthetic",
          displayName: "Synthetic",
          status: "degraded",
          limits: [],
          error: errMsg,
          fetchedAt: now,
        };
      }

      const json = await res.json();
      const data = json as RawQuotasResponse;

      const limits: NormalizedLimit[] = [
        buildRollingFiveHour(data.rollingFiveHourLimit, now),
        buildWeeklyTokenLimit(data.weeklyTokenLimit, now),
        buildSearchHourly(data.search?.hourly, now),
      ].filter((l): l is NonNullable<typeof l> => l !== null);

      return {
        provider: "synthetic",
        displayName: "Synthetic",
        status: "operational",
        limits,
        fetchedAt: now,
      };
    } catch (err) {
      return {
        provider: "synthetic",
        displayName: "Synthetic",
        status: "outage",
        limits: [],
        error: err instanceof Error ? err.message : "Unknown error",
        fetchedAt: now,
      };
    }
  },
};
