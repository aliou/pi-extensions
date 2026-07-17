import type {
  ProviderId,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";

export interface ModelUsageState {
  snapshots: ProviderUsageSnapshot[];
  projections: Map<string, ProjectionHint>;
  fresh?: boolean;
}

export interface ModelUsageReader {
  state(): ModelUsageState | undefined;
  snapshot(provider: ProviderId | string): ProviderUsageSnapshot | undefined;
  quotas(provider?: ProviderId | string): UsageQuota[];
  projection(quota: UsageQuota): ProjectionHint | undefined;
}

export type ProjectionHint =
  | { kind: "stable" }
  | { kind: "projected"; usedPercent: number; horizonMs: number }
  | { kind: "empty"; timeToEmptyMs: number };
