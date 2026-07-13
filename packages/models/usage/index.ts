export {
  applyUsageObservationToCache,
  mergeUsageObservation,
  readUsageCache,
  type UsageCacheResult,
  writeUsageCache,
} from "./cache";
export {
  appendUsageHistory,
  buildProjectionHints,
  type ProjectionHint,
  quotaHistoryKey,
} from "./history";

import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import type { ModelUsageReader, ModelUsageState } from "../types";
import { type ProjectionHint, quotaHistoryKey } from "./history";

export class CachedModelUsage implements ModelUsageReader {
  constructor(private readonly usage: ModelUsageState | undefined) {}

  state(): ModelUsageState | undefined {
    return this.usage;
  }

  snapshot(provider: string): ProviderUsageSnapshot | undefined {
    return this.usage?.snapshots.find(
      (snapshot) => snapshot.provider === provider,
    );
  }

  quotas(provider?: string): UsageQuota[] {
    const snapshots = provider
      ? this.usage?.snapshots.filter(
          (snapshot) => snapshot.provider === provider,
        )
      : this.usage?.snapshots;
    return snapshots?.flatMap((snapshot) => snapshot.quotas) ?? [];
  }

  projection(quota: UsageQuota): ProjectionHint | undefined {
    return this.usage?.projections.get(quotaHistoryKey(quota));
  }
}
