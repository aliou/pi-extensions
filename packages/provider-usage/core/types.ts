export type ProviderId =
  | "anthropic"
  | "openai-codex"
  | "synthetic"
  | "neuralwatt"
  | "openrouter";

export interface ProviderUsageClient {
  id: ProviderId;
  displayName: string;
  capabilities: ProviderUsageCapabilities;
  fetchUsage(ctx?: ProviderUsageFetchContext): Promise<ProviderUsageSnapshot>;
  parseResponseHeaders?(
    headers: Record<string, string>,
    ctx?: ProviderUsageParseContext,
  ): ProviderUsageObservation[];
}

export interface ProviderUsageCapabilities {
  api: boolean;
  oauth: boolean;
  apiKey: boolean;
  responseHeaders: boolean;
  status: boolean;
}

export interface ProviderUsageFetchContext {
  getProviderApiKey?: (provider: ProviderId) => Promise<string | undefined>;
  signal?: AbortSignal;
  now?: Date;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /**
   * Aperture gateway base URL. Proxied providers (synthetic, neuralwatt) fetch
   * usage through `${apertureBaseUrl}/v1/connectors/{id}/...` instead of
   * hitting upstream APIs directly. Anthropic (Claude Code subscription
   * OAuth endpoint) and OpenAI Codex ignore this.
   */
  apertureBaseUrl?: string;
}

export interface ProviderUsageParseContext {
  now?: Date;
}

export interface ProviderUsageSnapshot {
  provider: ProviderId;
  displayName: string;
  fetchedAt: Date;
  status?: ProviderStatus;
  account?: ProviderAccount;
  quotas: UsageQuota[];
  source: UsageSource;
  raw?: unknown;
  errors?: ProviderUsageError[];
}

export interface ProviderUsageObservation {
  provider: ProviderId;
  displayName?: string;
  observedAt: Date;
  status?: ProviderStatus;
  account?: ProviderAccount;
  quotas: UsageQuota[];
  source: UsageSource;
}

export interface ProviderStatus {
  available?: boolean;
  limited?: boolean;
  blocked?: boolean;
  plan?: string;
  message?: string;
}

export interface ProviderAccount {
  id?: string;
  email?: string;
  plan?: string;
}

export interface ProviderUsageError {
  code: string;
  message: string;
  status?: number;
  retryable?: boolean;
}

export interface UsageSource {
  kind: "api" | "response-header" | "probe" | "cache";
  endpoint?: string;
  fetchedAt?: Date;
}

export interface UsageQuota {
  provider: ProviderId;
  id: string;
  name: string;
  scope?: string;
  role?: QuotaRole;
  updatedAt: Date;
  metric: UsageMetric;
  amount: UsageAmount;
  period: UsagePeriod;
  depletion: DepletionModel;
  replenishment: ReplenishmentModel;
  state?: QuotaState;
  expirationDates?: Date[];
  source: UsageSource;
  raw?: unknown;
}

export type UsageMetric =
  | { kind: "percent" }
  | { kind: "count"; unit: string }
  | { kind: "currency"; code: string; minorUnit: boolean }
  | { kind: "energy"; unit: string };

export interface UsageAmount {
  usedPercent: number;
  capacity?: number;
  used?: number;
  remaining?: number;
}

export type UsagePeriod =
  | {
      kind: "rolling";
      label: string;
      durationMs?: number;
      startsAt?: Date | null;
      endsAt?: Date | null;
    }
  | {
      kind: "calendar";
      label: string;
      durationMs?: number;
      startsAt?: Date | null;
      endsAt?: Date | null;
    }
  | {
      kind: "billing";
      label: string;
      startsAt?: Date | null;
      endsAt?: Date | null;
    }
  | { kind: "allowance"; label: string }
  | { kind: "unknown"; label?: string };

export type DepletionModel =
  | { kind: "monotonic" }
  | { kind: "remaining-balance" }
  | { kind: "offset-burn" }
  | { kind: "unknown" };

export type ReplenishmentModel =
  | { kind: "none" }
  | { kind: "full-reset"; at: Date | null }
  | {
      kind: "discrete-tick";
      amount: number;
      intervalMs: number;
      nextAt: Date;
      cap?: number;
    }
  | {
      kind: "scheduled";
      amount?: number | null;
      at: Date | null;
      cap?: number;
    };

export type QuotaRole =
  | "primary"
  | "secondary"
  | "model"
  | "budget"
  | "allowance"
  | "ancillary";

export interface QuotaState {
  limited?: boolean;
  overage?: boolean;
  blocked?: boolean;
}
