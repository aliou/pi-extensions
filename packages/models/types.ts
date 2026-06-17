import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";
import type {
  ProviderId,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";

export type ModelGroupId =
  | "ad:utility:text"
  | "ad:session:read"
  | "ad:codebase:local"
  | "ad:codebase:remote"
  | "ad:review:diff"
  | "ad:advisor:technical"
  | "ad:advisor:design"
  | "ad:vision:inspect";

export interface ModelPreference {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
  quotaRefs?: QuotaRef[];
}

export type QuotaRef =
  | { kind: "provider"; ids?: string[] }
  | { kind: "model"; ids?: string[]; scopes?: string[] };

export interface ModelPreferenceRecord {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
}

export interface ModelChoice {
  model: Model<Api>;
  thinking: ThinkingLevel | "off";
  preference: ModelPreferenceRecord;
  skipped: SkippedModelPreference[];
}

export interface SkippedModelPreference {
  preference: ModelPreferenceRecord;
  reason: ModelUnusableReason;
  detail?: string;
}

export type ModelUsability =
  | { usable: true; model: Model<Api> }
  | { usable: false; reason: ModelUnusableReason; detail?: string };

export type ModelUnusableReason =
  | "unknown-model"
  | "unauthed"
  | "provider-unavailable"
  | "quota-blocked";

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

export type ModelRosters = Record<ModelGroupId, readonly ModelPreference[]>;
