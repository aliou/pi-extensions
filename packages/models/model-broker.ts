import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import { defaultModelRosters } from "./groups";
import type {
  ModelChoice,
  ModelGroupId,
  ModelPreference,
  ModelPreferenceRecord,
  ModelRosters,
  ModelUnusableReason,
  ModelUsability,
  ModelUsageReader,
  QuotaRef,
  SkippedModelPreference,
} from "./types";

const EXHAUSTED_USED_PERCENT = 95;
const PROJECTED_EMPTY_BLOCK_MS = 6 * 60 * 60_000;

export interface ModelBrokerDeps {
  registry: ModelRegistry;
  usage?: ModelUsageReader;
  rosters?: ModelRosters;
}

export class ModelBroker {
  readonly usage: ModelUsageReader | undefined;
  private readonly rosters: ModelRosters;

  constructor(private readonly deps: ModelBrokerDeps) {
    deps.registry.refresh?.();
    this.usage = deps.usage;
    this.rosters = deps.rosters ?? defaultModelRosters;
  }

  choose(group: ModelGroupId): ModelChoice | null {
    return this.roster(group)[0] ?? null;
  }

  roster(group: ModelGroupId): ModelChoice[] {
    return this.chooseFrom(this.rosters[group] ?? []);
  }

  resolve(
    group: ModelGroupId,
    pinned: ModelPreferenceRecord | undefined,
  ): ModelChoice | null {
    if (pinned) {
      const choice = this.choiceForPreference(pinned, []);
      if (choice) return choice;
    }

    return this.choose(group);
  }

  chooseFrom(preferences: readonly ModelPreference[]): ModelChoice[] {
    const choices: ModelChoice[] = [];
    const skipped: SkippedModelPreference[] = [];

    for (const preference of preferences) {
      const usability = this.usability(preference);
      if (!usability.usable) {
        if (shouldReportSkip(usability.reason)) {
          skipped.push({
            preference: recordFor(preference),
            reason: usability.reason,
            detail: usability.detail,
          });
        }
        continue;
      }

      choices.push({
        model: usability.model,
        thinking: preference.thinking,
        preference: recordFor(preference),
        skipped: [...skipped],
      });
    }

    return choices;
  }

  usability(preference: ModelPreference): ModelUsability {
    const model = this.deps.registry.find(
      preference.provider,
      preference.model,
    );
    if (!model) return { usable: false, reason: "unknown-model" };
    if (!this.deps.registry.hasConfiguredAuth(model)) {
      return { usable: false, reason: "unauthed" };
    }

    const snapshot = this.usage?.snapshot(preference.provider);
    if (!snapshot) return { usable: true, model };

    const providerBlock = providerBlockReason(snapshot);
    if (providerBlock) {
      return {
        usable: false,
        reason: "provider-unavailable",
        detail: providerBlock,
      };
    }

    const quotaBlock = this.quotaBlockReason(preference, snapshot);
    if (quotaBlock) {
      return { usable: false, reason: "quota-blocked", detail: quotaBlock };
    }

    return { usable: true, model };
  }

  private choiceForPreference(
    preference: ModelPreferenceRecord,
    skipped: SkippedModelPreference[],
  ): ModelChoice | null {
    const usability = this.usability(preference);
    if (!usability.usable) return null;
    return {
      model: usability.model,
      thinking: preference.thinking,
      preference,
      skipped,
    };
  }

  private quotaBlockReason(
    preference: ModelPreference,
    snapshot: ProviderUsageSnapshot,
  ): string | undefined {
    for (const quota of applicableQuotas(preference, snapshot)) {
      const reason = this.quotaReason(quota);
      if (reason) return reason;
    }
    return undefined;
  }

  private quotaReason(quota: UsageQuota): string | undefined {
    if (quota.state?.blocked) return `${quota.name} blocked`;
    const projection = this.usage?.projection(quota);
    if (
      projection?.kind === "empty" &&
      projection.timeToEmptyMs <= PROJECTED_EMPTY_BLOCK_MS
    ) {
      return `${quota.name} projected empty in ${formatDuration(projection.timeToEmptyMs)}`;
    }

    const projectedPercent =
      projection?.kind === "projected" ? projection.usedPercent : undefined;
    const usedPercent = Math.max(
      quota.amount.usedPercent,
      projectedPercent ?? 0,
    );

    if (usedPercent >= EXHAUSTED_USED_PERCENT) {
      const label =
        projectedPercent != null && projectedPercent >= quota.amount.usedPercent
          ? "projected"
          : "usage";
      return `${quota.name} ${label} ${Math.round(usedPercent)}%`;
    }

    if (quota.state?.limited) return `${quota.name} limited`;
    return undefined;
  }
}

function providerBlockReason(
  snapshot: ProviderUsageSnapshot,
): string | undefined {
  if (snapshot.status?.blocked)
    return snapshot.status.message ?? "provider blocked";
  if (snapshot.status?.available === false) {
    return snapshot.status.message ?? "provider unavailable";
  }
  return undefined;
}

function applicableQuotas(
  preference: ModelPreference,
  snapshot: ProviderUsageSnapshot,
): UsageQuota[] {
  const explicit = preference.quotaRefs?.flatMap((ref) =>
    quotasForRef(ref, snapshot.quotas, preference),
  );
  if (explicit?.length) return uniqueQuotas(explicit);

  return snapshot.quotas.filter((quota) => isDefaultQuota(preference, quota));
}

function quotasForRef(
  ref: QuotaRef,
  quotas: UsageQuota[],
  preference: ModelPreference,
): UsageQuota[] {
  if (ref.kind === "provider") {
    return quotas.filter(
      (quota) =>
        quota.provider === preference.provider &&
        quota.role !== "model" &&
        quota.role !== "ancillary" &&
        matchesIds(ref.ids, quota),
    );
  }

  return quotas.filter(
    (quota) =>
      quota.provider === preference.provider &&
      quota.role === "model" &&
      matchesModelRef(ref, quota),
  );
}

function isDefaultQuota(
  preference: ModelPreference,
  quota: UsageQuota,
): boolean {
  if (quota.provider !== preference.provider) return false;
  if (quota.role === "ancillary") return false;

  if (quota.role === "model") {
    return modelQuotaMatchesPreference(preference, quota);
  }

  return true;
}

function modelQuotaMatchesPreference(
  preference: ModelPreference,
  quota: UsageQuota,
): boolean {
  if (quota.scope && modelMatchesToken(preference.model, quota.scope))
    return true;
  if (modelMatchesToken(preference.model, quota.id)) return true;

  if (preference.provider === "anthropic") {
    if (preference.model.includes("opus")) return quota.scope === "opus";
    if (preference.model.includes("sonnet")) return quota.scope === "sonnet";
    if (preference.model.includes("haiku")) return quota.scope === "haiku";
  }

  return false;
}

function matchesIds(ids: string[] | undefined, quota: UsageQuota): boolean {
  return !ids?.length || ids.includes(quota.id);
}

function matchesModelRef(
  ref: Extract<QuotaRef, { kind: "model" }>,
  quota: UsageQuota,
): boolean {
  const hasIds = Boolean(ref.ids?.length);
  const hasScopes = Boolean(ref.scopes?.length);
  if (!hasIds && !hasScopes) return true;

  return (
    (hasIds && matchesIds(ref.ids, quota)) ||
    (hasScopes &&
      quota.scope != null &&
      Boolean(ref.scopes?.includes(quota.scope)))
  );
}

function modelMatchesToken(model: string, token: string): boolean {
  const normalizedModel = normalize(model);
  const normalizedToken = normalize(token);
  return (
    normalizedModel === normalizedToken ||
    normalizedModel.includes(normalizedToken) ||
    normalizedToken.includes(normalizedModel)
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/^hf:/, "")
    .replace(/[^a-z0-9]+/g, "-");
}

function uniqueQuotas(quotas: UsageQuota[]): UsageQuota[] {
  const seen = new Set<string>();
  return quotas.filter((quota) => {
    const key = `${quota.provider}:${quota.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordFor(preference: ModelPreference): ModelPreferenceRecord {
  return {
    provider: preference.provider,
    model: preference.model,
    thinking: preference.thinking,
  };
}

function shouldReportSkip(reason: ModelUnusableReason): boolean {
  return reason === "provider-unavailable" || reason === "quota-blocked";
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}
