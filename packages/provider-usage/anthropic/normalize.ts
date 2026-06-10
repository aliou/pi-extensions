import type {
  ProviderUsageSnapshot,
  UsageQuota,
  UsageSource,
} from "../core/index";
import type {
  AnthropicOAuthUsageResponse,
  AnthropicPercentWindow,
} from "./raw-types";

const PROVIDER = "anthropic" as const;
const ENDPOINT = "https://api.anthropic.com/api/oauth/usage";

const WINDOWS: Array<
  [keyof AnthropicOAuthUsageResponse, string, number, string | undefined]
> = [
  ["five_hour", "5 hour", 5 * 60 * 60 * 1000, undefined],
  ["seven_day", "7 day", 7 * 24 * 60 * 60 * 1000, undefined],
  ["seven_day_sonnet", "Sonnet 7 day", 7 * 24 * 60 * 60 * 1000, "sonnet"],
  ["seven_day_opus", "Opus 7 day", 7 * 24 * 60 * 60 * 1000, "opus"],
  [
    "seven_day_oauth_apps",
    "OAuth apps 7 day",
    7 * 24 * 60 * 60 * 1000,
    "oauth-apps",
  ],
];

export function normalizeAnthropicUsage(
  raw: AnthropicOAuthUsageResponse,
  fetchedAt: Date,
): ProviderUsageSnapshot {
  const source: UsageSource = { kind: "api", endpoint: ENDPOINT, fetchedAt };
  const quotas: UsageQuota[] = [];

  for (const [key, label, durationMs, scope] of WINDOWS) {
    const window = raw[key];
    if (!isWindow(window)) continue;
    quotas.push({
      provider: PROVIDER,
      id: key,
      name: label,
      scope,
      role: scope ? "model" : key === "five_hour" ? "primary" : "secondary",
      updatedAt: fetchedAt,
      metric: { kind: "percent" },
      amount: { usedPercent: window.utilization },
      period: {
        kind: "rolling",
        label,
        durationMs,
        endsAt: parseDate(window.resets_at),
      },
      depletion: { kind: "monotonic" },
      replenishment: { kind: "full-reset", at: parseDate(window.resets_at) },
      source,
      raw: window,
    });
  }

  if (raw.extra_usage) {
    quotas.push({
      provider: PROVIDER,
      id: "extra_usage",
      name: "Extra usage",
      role: "budget",
      updatedAt: fetchedAt,
      metric: {
        kind: "currency",
        code: raw.extra_usage.currency,
        minorUnit: true,
      },
      amount: {
        usedPercent: raw.extra_usage.utilization,
        capacity: raw.extra_usage.monthly_limit,
        used: raw.extra_usage.used_credits,
        remaining: Math.max(
          0,
          raw.extra_usage.monthly_limit - raw.extra_usage.used_credits,
        ),
      },
      period: {
        kind: "calendar",
        label: "monthly",
        startsAt: monthStart(fetchedAt),
        endsAt: nextMonthStart(fetchedAt),
      },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "full-reset", at: nextMonthStart(fetchedAt) },
      state: { blocked: !raw.extra_usage.is_enabled },
      source,
      raw: raw.extra_usage,
    });
  }

  return {
    provider: PROVIDER,
    displayName: "Anthropic",
    fetchedAt,
    status: { available: true },
    quotas,
    source,
    raw,
  };
}

function isWindow(value: unknown): value is AnthropicPercentWindow {
  return !!value && typeof value === "object" && "utilization" in value;
}

function parseDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
