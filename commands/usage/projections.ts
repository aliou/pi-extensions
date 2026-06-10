import type { UsageQuota } from "@harness/provider-usage";
import type { ProjectionHint } from "./history";
import { quotaHistoryKey } from "./history";

let projectionHints = new Map<string, ProjectionHint>();

export function setProjectionHints(hints: Map<string, ProjectionHint>): void {
  projectionHints = hints;
}

export function getProjectionHint(
  quota: UsageQuota,
): ProjectionHint | undefined {
  return projectionHints.get(quotaHistoryKey(quota));
}
