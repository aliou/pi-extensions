import type { AuthStorage } from "@mariozechner/pi-coding-agent";
import type {
  FixedWindowLimit,
  NormalizedLimit,
  ProviderSnapshot,
  ProviderStatus,
} from "../types";
import type { ProviderAdapter } from "./base";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const STATUS_URL = "https://status.openai.com/api/v2/status.json";

// --- Raw API response types ---

interface RawWindow {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_at?: number;
  reset_after_seconds?: number;
}

interface RawRateLimit {
  allowed?: boolean;
  limit_reached?: boolean;
  primary_window?: RawWindow | null;
  secondary_window?: RawWindow | null;
}

interface RawAdditionalRateLimit {
  limit_name?: string;
  metered_feature?: string;
  rate_limit?: RawRateLimit;
}

interface RawCredits {
  has_credits?: boolean;
  unlimited?: boolean;
  balance?: string | number;
}

interface RawUsageResponse {
  plan_type?: string;
  rate_limit?: RawRateLimit;
  additional_rate_limits?: RawAdditionalRateLimit[];
  credits?: RawCredits;
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

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

function windowLabel(seconds: number | undefined, fallback: string): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return fallback;
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return days === 7 ? "7-day window" : `${days}-day window`;
  }
  const hours = Math.round(seconds / 3600);
  return `${hours}h window`;
}

function buildWindow(
  idSuffix: string,
  labelFallback: string,
  entry: RawWindow | null | undefined,
  now: Date,
  scope?: string,
): FixedWindowLimit | null {
  if (!entry) return null;
  const usedPercent = Math.max(0, Math.min(100, entry.used_percent ?? 0));
  const resetsAt = entry.reset_at ? new Date(entry.reset_at * 1000) : null;
  const ws = entry.limit_window_seconds;
  const label = windowLabel(ws, labelFallback);
  const id = scope
    ? `codex:${scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${idSuffix}`
    : `codex:${idSuffix}`;

  return {
    kind: "fixed-window",
    provider: "openai-codex",
    id,
    name: label,
    scope,
    usedPercent,
    resetsAt,
    windowSeconds:
      ws && Number.isFinite(ws) && ws > 0 ? Math.round(ws) : undefined,
    updatedAt: now,
  };
}

// --- Adapter ---

export const codexAdapter: ProviderAdapter = {
  provider: "openai-codex",

  async fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot> {
    const now = new Date();

    // Codex stores access token + accountId in the credential object.
    const credential = authStorage.get("openai-codex") as
      | {
          access?: string;
          accountId?: string;
          account_id?: string;
          key?: string;
        }
      | undefined;
    const token =
      credential?.access ??
      credential?.key ??
      (await authStorage.getApiKey("openai-codex"));

    if (!token) {
      return {
        provider: "openai-codex",
        displayName: "Codex",
        status: "unknown",
        limits: [],
        error: "Not configured",
        fetchedAt: now,
      };
    }

    const accountId = credential?.accountId ?? credential?.account_id;
    const combined = timeoutSignal(8000, signal);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "User-Agent": "PiUsage",
      Accept: "application/json",
    };
    if (accountId) {
      headers["ChatGPT-Account-Id"] = accountId;
    }

    let status: ProviderStatus = "unknown";
    let statusMessage: string | undefined;
    let error: string | undefined;
    let usageJson: RawUsageResponse | null = null;

    try {
      const [usageRes, statusRes] = await Promise.all([
        fetch(USAGE_URL, { headers, signal: combined }),
        fetch(STATUS_URL, { signal: combined }).catch(() => null),
      ]);

      if (statusRes?.ok) {
        try {
          const sj = (await statusRes.json()) as StatusResponse;
          status = mapStatus(sj.status?.indicator);
          statusMessage = sj.status?.description;
        } catch {
          // ignore
        }
      }

      if (!usageRes.ok) {
        if (usageRes.status === 401 || usageRes.status === 403) {
          error = "Token expired or unauthorized";
        } else {
          error = `HTTP ${usageRes.status}`;
        }
      } else {
        usageJson = (await usageRes.json()) as RawUsageResponse;
      }
    } catch {
      error =
        combined.aborted || signal?.aborted
          ? "Request aborted"
          : "Network error";
    }

    if (error || !usageJson) {
      return {
        provider: "openai-codex",
        displayName: "Codex",
        status,
        statusMessage,
        limits: [],
        error: error ?? "No data",
        fetchedAt: now,
      };
    }

    // Build limits.
    const limits: NormalizedLimit[] = [];

    // Main rate limit windows.
    const primary = buildWindow(
      "primary",
      "5h window",
      usageJson.rate_limit?.primary_window,
      now,
    );
    if (primary) limits.push(primary);

    const secondary = buildWindow(
      "secondary",
      "7d window",
      usageJson.rate_limit?.secondary_window,
      now,
    );
    if (secondary) limits.push(secondary);

    // Additional per-model rate limits (e.g. Spark).
    if (usageJson.additional_rate_limits) {
      for (const additional of usageJson.additional_rate_limits) {
        const scope =
          additional.limit_name ?? additional.metered_feature ?? "unknown";
        const rl = additional.rate_limit;
        if (!rl) continue;

        const ap = buildWindow(
          "primary",
          "5h window",
          rl.primary_window,
          now,
          scope,
        );
        if (ap) limits.push(ap);

        const as_ = buildWindow(
          "secondary",
          "7d window",
          rl.secondary_window,
          now,
          scope,
        );
        if (as_) limits.push(as_);
      }
    }

    // Credits.
    let credits: ProviderSnapshot["credits"] | undefined;
    if (usageJson.credits) {
      const c = usageJson.credits;
      const balance =
        typeof c.balance === "number"
          ? c.balance
          : typeof c.balance === "string"
            ? Number.parseFloat(c.balance)
            : undefined;
      credits = {
        hasCredits: c.has_credits ?? false,
        unlimited: c.unlimited ?? false,
        balance: Number.isFinite(balance) ? balance : undefined,
      };
    }

    return {
      provider: "openai-codex",
      displayName: "Codex",
      status,
      statusMessage,
      plan: usageJson.plan_type,
      limits,
      credits,
      fetchedAt: now,
    };
  },
};
