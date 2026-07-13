import type {
  ProviderId,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";

export type UsageSeverity = "none" | "warning" | "high" | "critical";

export interface UsageDashboard {
  snapshots: ProviderUsageSnapshot[];
  fromCache: boolean;
  stale: boolean;
  refreshedAt: Date;
}

export interface UsageQuotaView {
  provider: ProviderId;
  quota: UsageQuota;
  title: string;
  subtitle?: string;
  usedPercent: number;
  usageLabel: string;
  renewsLabel?: string;
  expirationLabel?: string;
  pacePercent?: number | null;
  markerPercent?: number | null;
  projectedPercent?: number | null;
  projectionLabel?: string;
  severity: UsageSeverity;
  message?: string;
  blocked: boolean;
}
