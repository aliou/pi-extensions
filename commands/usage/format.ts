import type { UsageQuota } from "@harness/provider-usage";

export function formatLastUpdated(date: Date): string {
  if (date.getTime() === 0) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 24 * 60 * 60_000)
    return `${Math.floor(diffMs / (60 * 60_000))}h ago`;
  return date.toLocaleString();
}

export function formatReset(
  date: Date | null | undefined,
  prefix = "resets",
): string | undefined {
  if (!date) return undefined;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return `${prefix} now`;
  return `${prefix} in ${formatDuration(diffMs)}`;
}

export function formatUsageLabel(quota: UsageQuota): string {
  const { amount, metric } = quota;
  const percent = `${Math.round(amount.usedPercent)}%`;

  if (metric.kind === "percent") return percent;

  if (metric.kind === "currency") {
    const scale = metric.minorUnit ? 100 : 1;
    if (amount.capacity != null)
      return `${percent}/${formatMoney(amount.capacity / scale, metric.code)}`;
  }

  if (metric.kind === "energy") {
    if (amount.capacity != null)
      return `${percent}/${round(amount.capacity)}${metric.unit}`;
    return percent;
  }

  if (metric.kind === "count") {
    const unit = unitLabel(metric.unit);
    if (amount.remaining != null)
      return `${round(amount.remaining)} ${unit} available`;
    if (amount.capacity != null && quota.depletion.kind === "offset-burn")
      return `${percent}/${round(amount.capacity)}${unit}`;
    if (amount.used != null && amount.capacity != null)
      return `${round(amount.used)}/${round(amount.capacity)}${unit}`;
    if (amount.capacity != null)
      return `${percent}/${round(amount.capacity)}${unit}`;
  }

  return percent;
}

export function quotaRenewalLabel(quota: UsageQuota): string | undefined {
  const replenishment = quota.replenishment;
  if (replenishment.kind === "full-reset")
    return formatReset(replenishment.at, "resets");
  if (replenishment.kind === "scheduled") {
    const when = formatRelative(replenishment.at);
    if (!when) return undefined;
    const amount = formatRegenAmount(quota, replenishment.amount);
    return amount ? `${amount} ${when}` : `regens ${when}`;
  }
  if (replenishment.kind === "discrete-tick") {
    const amount = formatRegenAmount(quota, replenishment.amount);
    return amount
      ? `${amount} ${formatRelative(replenishment.nextAt)}`
      : formatReset(replenishment.nextAt, "ticks");
  }
  if ("endsAt" in quota.period) return formatReset(quota.period.endsAt, "ends");
  return undefined;
}

export function quotaExpirationLabel(quota: UsageQuota): string | undefined {
  if (!quota.expirationDates?.length) return undefined;
  const dates = quota.expirationDates.map((date) =>
    date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );
  return `expires ${dates.join(" · ")}`;
}

export function periodSubtitle(quota: UsageQuota): string | undefined {
  if (quota.provider === "openai-codex") return undefined;
  if (quota.provider === "anthropic")
    return quota.id === "extra_usage" ? "monthly" : undefined;
  return quota.period.label;
}

function formatRelative(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "now";
  return `in ${formatDuration(diffMs)}`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d${remHours}h` : `${days}d`;
}

function formatRegenAmount(
  quota: UsageQuota,
  amount: number | null | undefined,
): string | undefined {
  if (amount == null) return undefined;
  if (quota.metric.kind === "currency")
    return `+${formatMoney(amount, quota.metric.code)}`;
  return `+${round(amount)}`;
}

function formatMoney(value: number, code: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function unitLabel(unit: string): string {
  if (unit === "request") return "reqs";
  return unit.endsWith("s") ? unit : `${unit}s`;
}
