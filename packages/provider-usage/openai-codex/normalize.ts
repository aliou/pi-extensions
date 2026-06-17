import type {
  ProviderUsageSnapshot,
  UsageQuota,
  UsageSource,
} from "../core/index";
import type { OpenAiCodexUsageResponse, OpenAiWindow } from "./raw-types";

const PROVIDER = "openai-codex" as const;
const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

export function normalizeOpenAiCodexUsage(
  raw: OpenAiCodexUsageResponse,
  fetchedAt: Date,
): ProviderUsageSnapshot {
  const source: UsageSource = { kind: "api", endpoint: ENDPOINT, fetchedAt };
  const quotas: UsageQuota[] = [];
  addWindow(
    quotas,
    "primary_window",
    "5h window",
    raw.rate_limit?.primary_window,
    "primary",
    undefined,
    source,
    fetchedAt,
    raw.rate_limit?.limit_reached,
  );
  addWindow(
    quotas,
    "secondary_window",
    "7 day window",
    raw.rate_limit?.secondary_window,
    "secondary",
    undefined,
    source,
    fetchedAt,
    raw.rate_limit?.limit_reached,
  );

  for (const limit of raw.additional_rate_limits ?? []) {
    addWindow(
      quotas,
      `${limit.metered_feature ?? slug(limit.limit_name)}.primary_window`,
      `5h window (${limit.limit_name.toLowerCase()})`,
      limit.rate_limit.primary_window,
      "model",
      limit.metered_feature ?? slug(limit.limit_name),
      source,
      fetchedAt,
      limit.rate_limit.limit_reached,
    );
    addWindow(
      quotas,
      `${limit.metered_feature ?? slug(limit.limit_name)}.secondary_window`,
      `7 day window (${limit.limit_name.toLowerCase()})`,
      limit.rate_limit.secondary_window,
      "model",
      limit.metered_feature ?? slug(limit.limit_name),
      source,
      fetchedAt,
      limit.rate_limit.limit_reached,
    );
  }

  if (raw.credits?.has_credits) {
    const balance = Number(raw.credits.balance);
    quotas.push({
      provider: PROVIDER,
      id: "credits",
      name: "Credits",
      role: "budget",
      updatedAt: fetchedAt,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: 0,
        remaining: Number.isFinite(balance) ? balance : undefined,
      },
      period: { kind: "allowance", label: "credits" },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "none" },
      state: { blocked: raw.credits.overage_limit_reached },
      source,
      raw: raw.credits,
    });
  }

  return {
    provider: PROVIDER,
    displayName: "OpenAI Codex",
    fetchedAt,
    status: {
      available: raw.rate_limit?.allowed,
      limited:
        raw.rate_limit?.limit_reached ||
        raw.spend_control?.reached ||
        !!raw.rate_limit_reached_type,
      plan: raw.plan_type,
    },
    account: { id: raw.account_id, email: raw.email, plan: raw.plan_type },
    quotas,
    source,
    raw,
  };
}

function addWindow(
  quotas: UsageQuota[],
  id: string,
  name: string,
  window: OpenAiWindow | null | undefined,
  role: UsageQuota["role"],
  scope: string | undefined,
  source: UsageSource,
  fetchedAt: Date,
  limited?: boolean,
): void {
  if (!window) return;
  const endsAt = window.reset_at ? new Date(window.reset_at * 1000) : null;
  quotas.push({
    provider: PROVIDER,
    id,
    name,
    scope,
    role,
    updatedAt: fetchedAt,
    metric: { kind: "percent" },
    amount: { usedPercent: window.used_percent },
    period: {
      kind: "rolling",
      label: windowLabel(window),
      durationMs: window.limit_window_seconds
        ? window.limit_window_seconds * 1000
        : undefined,
      endsAt,
    },
    depletion: { kind: "monotonic" },
    replenishment: { kind: "full-reset", at: endsAt },
    state: { limited },
    source,
    raw: window,
  });
}

function windowLabel(window: OpenAiWindow): string {
  if (window.limit_window_seconds === 18_000) return "5 hour";
  if (window.limit_window_seconds === 604_800) return "7 day";
  return window.limit_window_seconds
    ? `${Math.round(window.limit_window_seconds / 3600)} hour`
    : "window";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
