import type { AuthStorage } from "@earendil-works/pi-coding-agent";
import type {
  FixedWindowLimit,
  ProviderSnapshot,
  ProviderStatus,
  RegenBudgetLimit,
} from "../types";
import type { ProviderAdapter } from "./base";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const STATUS_URL = "https://status.claude.com/api/v2/status.json";

// --- Raw API response types ---

interface OAuthUsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface OAuthExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number;
  used_credits?: number;
  utilization?: number;
  currency?: string;
}

interface OAuthUsageResponse {
  five_hour?: OAuthUsageWindow | null;
  seven_day?: OAuthUsageWindow | null;
  seven_day_sonnet?: OAuthUsageWindow | null;
  seven_day_opus?: OAuthUsageWindow | null;
  extra_usage?: OAuthExtraUsage | null;
}

interface StatusResponse {
  status?: { indicator?: string; description?: string };
}

// --- Helpers ---

function mapStatus(indicator: string | undefined): ProviderStatus {
  if (indicator === "none") return "operational";
  if (indicator === "minor") return "degraded";
  if (indicator === "major" || indicator === "critical") return "outage";
  return "unknown";
}

function parseISO8601(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

function buildWindow(
  id: string,
  name: string,
  entry: OAuthUsageWindow | null | undefined,
  windowSeconds: number,
  now: Date,
): FixedWindowLimit | null {
  if (!entry) return null;
  const usedPercent = Math.max(0, Math.min(100, entry.utilization ?? 0));
  return {
    kind: "fixed-window",
    provider: "anthropic",
    id: `anthropic:${id}`,
    name,
    usedPercent,
    resetsAt: parseISO8601(entry.resets_at),
    windowSeconds,
    updatedAt: now,
  };
}

function buildExtraUsage(
  extra: OAuthExtraUsage | null | undefined,
  now: Date,
): RegenBudgetLimit | null {
  if (!extra?.is_enabled) return null;
  const usedCents =
    extra.used_credits != null ? Math.round(extra.used_credits) : null;
  const limitCents =
    extra.monthly_limit != null ? Math.round(extra.monthly_limit) : null;
  if (usedCents === null || limitCents === null || limitCents <= 0) return null;

  const currency = extra.currency?.trim() || "USD";

  return {
    kind: "regen-budget",
    provider: "anthropic",
    id: "anthropic:extra-usage",
    name: "Extra Usage",
    currency,
    maxAmountMinor: limitCents,
    remainingAmountMinor: Math.max(0, limitCents - usedCents),
    period: "Monthly",
    nextRegenAt: null,
    nextRegenAmountMinor: null,
    updatedAt: now,
  };
}

// --- Adapter ---

export const claudeAdapter: ProviderAdapter = {
  provider: "anthropic",

  async fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot> {
    const now = new Date();
    const token = await authStorage.getApiKey("anthropic");

    if (!token) {
      return {
        provider: "anthropic",
        displayName: "Claude",
        status: "unknown",
        limits: [],
        error: "Not configured",
        fetchedAt: now,
      };
    }

    const combined = timeoutSignal(8000, signal);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "claude-code/2.1.0",
      Accept: "application/json",
    };

    let status: ProviderStatus = "unknown";
    let statusMessage: string | undefined;
    let error: string | undefined;

    // Fetch usage + status in parallel.
    let usageJson: OAuthUsageResponse | null = null;

    try {
      const [usageRes, statusRes] = await Promise.all([
        fetch(USAGE_URL, { headers, signal: combined }),
        fetch(STATUS_URL, { signal: combined }).catch(() => null),
      ]);

      // Parse status page.
      if (statusRes?.ok) {
        try {
          const statusJson = await statusRes.json();
          const sj = statusJson as StatusResponse;
          status = mapStatus(sj.status?.indicator);
          statusMessage = sj.status?.description;
        } catch (_error) {
          void _error;
          // ignore
        }
      }

      // Parse usage.
      if (!usageRes.ok) {
        if (usageRes.status === 401 || usageRes.status === 403) {
          error = "Token expired or unauthorized";
        } else if (usageRes.status === 429) {
          error = "Rate limited";
        } else {
          error = `HTTP ${usageRes.status}`;
        }
      } else {
        const json = await usageRes.json();
        usageJson = json as OAuthUsageResponse;
      }
    } catch (_err) {
      error =
        combined.aborted || signal?.aborted
          ? "Request aborted"
          : "Network error";
    }

    if (error || !usageJson) {
      return {
        provider: "anthropic",
        displayName: "Claude",
        status,
        statusMessage,
        limits: [],
        error: error ?? "No data",
        fetchedAt: now,
      };
    }

    const FIVE_HOURS = 5 * 60 * 60;
    const SEVEN_DAYS = 7 * 24 * 60 * 60;

    const limits = [
      buildWindow(
        "five-hour",
        "5h window",
        usageJson.five_hour,
        FIVE_HOURS,
        now,
      ),
      buildWindow(
        "seven-day",
        "7d window",
        usageJson.seven_day,
        SEVEN_DAYS,
        now,
      ),
      buildWindow(
        "seven-day-sonnet",
        "7d Sonnet",
        usageJson.seven_day_sonnet,
        SEVEN_DAYS,
        now,
      ),
      buildWindow(
        "seven-day-opus",
        "7d Opus",
        usageJson.seven_day_opus,
        SEVEN_DAYS,
        now,
      ),
      buildExtraUsage(usageJson.extra_usage, now),
    ].filter((l): l is NonNullable<typeof l> => l !== null);

    return {
      provider: "anthropic",
      displayName: "Claude",
      status,
      statusMessage,
      limits,
      fetchedAt: now,
    };
  },
};
