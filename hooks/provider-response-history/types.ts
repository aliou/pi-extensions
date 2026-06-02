export const PROVIDER_EXTRA_USAGE_USED_EVENT =
  "provider:extra-usage:used" as const;

export interface HistoryLine {
  id: string;
  at: number;
  remaining: number;
}

export interface ProviderExtraUsageUsedPayload {
  provider: string;
  sessionId: string;
  at: number;
}
