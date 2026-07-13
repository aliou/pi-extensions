import type {
  ProviderUsageObservation,
  UsageQuota,
  UsageSource,
} from "../core/index";

const PROVIDER = "openai-codex" as const;

export function parseOpenAiCodexResponseHeaders(
  headers: Record<string, string>,
  now = new Date(),
): ProviderUsageObservation[] {
  const values = normalizedHeaders(headers);
  const source: UsageSource = { kind: "response-header", fetchedAt: now };
  const quotas: UsageQuota[] = [];
  const plan = value(values, "x-codex-plan-type");

  addWindow(
    quotas,
    values,
    "primary",
    "primary_window",
    "Primary window",
    undefined,
    source,
    now,
  );
  addWindow(
    quotas,
    values,
    "secondary",
    "secondary_window",
    "Secondary window",
    undefined,
    source,
    now,
  );

  const bengalfoxLimitName = value(values, "x-codex-bengalfox-limit-name");
  if (bengalfoxLimitName) {
    const scope = slug(bengalfoxLimitName);
    addWindow(
      quotas,
      values,
      "bengalfox-primary",
      `${scope}.primary_window`,
      `Primary window (${bengalfoxLimitName})`,
      scope,
      source,
      now,
    );
    addWindow(
      quotas,
      values,
      "bengalfox-secondary",
      `${scope}.secondary_window`,
      `Secondary window (${bengalfoxLimitName})`,
      scope,
      source,
      now,
    );
  }

  if (parseBoolean(value(values, "x-codex-credits-has-credits"))) {
    const balance = number(value(values, "x-codex-credits-balance"));
    quotas.push({
      provider: PROVIDER,
      id: "credits",
      name: "Credits",
      role: "budget",
      updatedAt: now,
      metric: { kind: "currency", code: "USD", minorUnit: false },
      amount: {
        usedPercent: 0,
        ...(balance != null ? { remaining: balance } : {}),
      },
      period: { kind: "allowance", label: "credits" },
      depletion: { kind: "remaining-balance" },
      replenishment: { kind: "none" },
      source,
    });
  }

  if (quotas.length === 0 && !plan) return [];
  return [
    {
      provider: PROVIDER,
      displayName: "OpenAI Codex",
      observedAt: now,
      status: { available: true, ...(plan ? { plan } : {}) },
      account: plan ? { plan } : undefined,
      quotas,
      source,
    },
  ];
}

function addWindow(
  quotas: UsageQuota[],
  headers: Map<string, string>,
  prefix: string,
  id: string,
  name: string,
  scope: string | undefined,
  source: UsageSource,
  now: Date,
): void {
  const usedPercent = number(value(headers, `x-codex-${prefix}-used-percent`));
  if (usedPercent == null || usedPercent < 0 || usedPercent > 100) return;

  const windowMinutes = number(
    value(headers, `x-codex-${prefix}-window-minutes`),
  );
  const resetAt = date(value(headers, `x-codex-${prefix}-reset-at`));
  const resetAfterSeconds = number(
    value(headers, `x-codex-${prefix}-reset-after-seconds`),
  );
  const endsAt =
    resetAt ??
    (resetAfterSeconds != null && resetAfterSeconds >= 0
      ? new Date(now.getTime() + resetAfterSeconds * 1000)
      : null);
  const durationMs =
    windowMinutes != null && windowMinutes > 0
      ? windowMinutes * 60_000
      : undefined;

  quotas.push({
    provider: PROVIDER,
    id,
    name,
    scope,
    role: scope ? "model" : id.startsWith("primary") ? "primary" : "secondary",
    updatedAt: now,
    metric: { kind: "percent" },
    amount: { usedPercent },
    period: {
      kind: "rolling",
      label: windowLabel(windowMinutes),
      durationMs,
      ...(endsAt ? { endsAt } : {}),
    },
    depletion: { kind: "monotonic" },
    replenishment: { kind: "full-reset", at: endsAt },
    source,
  });
}

function normalizedHeaders(
  headers: Record<string, string>,
): Map<string, string> {
  return new Map(
    Object.entries(headers as Record<string, unknown>).flatMap(
      ([name, headerValue]) =>
        typeof headerValue === "string"
          ? [[name.toLowerCase(), headerValue]]
          : [],
    ),
  );
}

function value(headers: Map<string, string>, name: string): string | undefined {
  const value = headers.get(name);
  return value?.trim() || undefined;
}

function number(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function date(value: string | undefined): Date | null {
  if (!value) return null;
  const numeric = number(value);
  const timestamp =
    numeric == null
      ? Date.parse(value)
      : numeric < 1_000_000_000_000
        ? numeric * 1000
        : numeric;
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

function windowLabel(windowMinutes: number | undefined): string {
  if (windowMinutes == null || windowMinutes <= 0) return "window";
  if (windowMinutes === 300) return "5 hour";
  if (windowMinutes === 10_080) return "7 day";
  return `${Math.round(windowMinutes / 60)} hour`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
