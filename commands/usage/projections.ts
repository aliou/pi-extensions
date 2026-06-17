import { type ProjectionHint, quotaHistoryKey } from "@harness/models/usage";
import type { UsageQuota } from "@harness/provider-usage";

let projectionHints = new Map<string, ProjectionHint>();

export function setProjectionHints(hints: Map<string, ProjectionHint>): void {
  projectionHints = hints;
}

export function getProjectionHint(
  quota: UsageQuota,
): ProjectionHint | undefined {
  return projectionHints.get(quotaHistoryKey(quota));
}
