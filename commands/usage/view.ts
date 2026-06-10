import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import {
  formatDuration,
  formatUsageLabel,
  periodSubtitle,
  quotaRenewalLabel,
} from "./format";
import { getProjectionHint } from "./projections";
import type { UsageQuotaView, UsageSeverity } from "./types";

const ROLE_ORDER = new Map<string, number>([
  ["primary", 0],
  ["secondary", 1],
  ["model", 2],
  ["budget", 3],
  ["allowance", 4],
  ["ancillary", 5],
]);

export function buildQuotaViews(
  snapshot: ProviderUsageSnapshot,
): UsageQuotaView[] {
  return [...snapshot.quotas].sort(compareQuotas).map((quota) => ({
    provider: snapshot.provider,
    quota,
    title: quota.name,
    subtitle: periodSubtitle(quota),
    usedPercent: clampPercent(quota.amount.usedPercent),
    usageLabel: formatUsageLabel(quota),
    renewsLabel: quotaRenewalLabel(quota),
    pacePercent: pacePercent(quota),
    markerPercent: markerPercent(quota),
    projectedPercent: projectedPercent(quota),
    projectionLabel: projectionLabel(quota),
    severity: severityForQuota(quota),
    message: messageForQuota(quota),
    blocked: Boolean(quota.state?.blocked || quota.state?.limited),
  }));
}

function compareQuotas(a: UsageQuota, b: UsageQuota): number {
  const role =
    (ROLE_ORDER.get(a.role ?? "") ?? 99) - (ROLE_ORDER.get(b.role ?? "") ?? 99);
  if (role !== 0) return role;
  return a.name.localeCompare(b.name);
}

function severityForQuota(quota: UsageQuota): UsageSeverity {
  if (quota.state?.blocked || quota.state?.limited) return "critical";
  if (quota.state?.overage) return "high";
  const percent = quota.amount.usedPercent;
  if (percent >= 90) return "critical";
  if (percent >= 75) return "high";
  if (percent >= 60) return "warning";
  return "none";
}

function messageForQuota(quota: UsageQuota): string | undefined {
  if (quota.state?.blocked) return "blocked";
  if (quota.state?.limited) return "limited";
  if (quota.state?.overage) return "overage";
  return undefined;
}

function pacePercent(quota: UsageQuota): number | null {
  const bounds = periodBounds(quota);
  if (!bounds) return null;
  const { start, end } = bounds;
  const elapsed = Date.now() - start.getTime();
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return null;
  return clampPercent((elapsed / duration) * 100);
}

function projectedPercent(quota: UsageQuota): number | null {
  const hint = getProjectionHint(quota);
  if (hint?.kind === "projected") return hint.usedPercent;
  if (
    quota.replenishment.kind === "scheduled" ||
    quota.replenishment.kind === "discrete-tick"
  )
    return null;
  const pace = pacePercent(quota);
  if (pace == null || pace <= 0) return null;
  return Math.max(0, Math.round((quota.amount.usedPercent / pace) * 100));
}

function projectionLabel(quota: UsageQuota): string | undefined {
  const hint = getProjectionHint(quota);
  if (!hint) return undefined;
  if (hint.kind === "stable") return "stable";
  if (hint.kind === "empty")
    return `empty in ${formatDuration(hint.timeToEmptyMs)}`;
  return `proj ${Math.round(hint.usedPercent)}% in ${formatDuration(hint.horizonMs)}`;
}

function markerPercent(quota: UsageQuota): number | null {
  if (
    quota.replenishment.kind === "discrete-tick" &&
    quota.replenishment.cap &&
    quota.amount.remaining != null
  ) {
    return clampPercent(
      ((quota.amount.remaining + quota.replenishment.amount) /
        quota.replenishment.cap) *
        100,
    );
  }
  return null;
}

function periodBounds(quota: UsageQuota): { start: Date; end: Date } | null {
  if (
    "startsAt" in quota.period &&
    quota.period.startsAt &&
    quota.period.endsAt
  ) {
    return { start: quota.period.startsAt, end: quota.period.endsAt };
  }
  if (
    quota.period.kind === "rolling" &&
    quota.period.durationMs &&
    quota.period.endsAt
  ) {
    return {
      start: new Date(quota.period.endsAt.getTime() - quota.period.durationMs),
      end: quota.period.endsAt,
    };
  }
  return null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
