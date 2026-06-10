export interface SyntheticQuotasResponse {
  subscription?: SyntheticLimit | null;
  search?: { hourly?: SyntheticLimit | null } | null;
  freeToolCalls?: SyntheticLimit | null;
  weeklyTokenLimit?: {
    nextRegenAt: string;
    percentRemaining: number;
    maxCredits: string;
    remainingCredits: string;
    nextRegenCredits: string;
  } | null;
  rollingFiveHourLimit?: {
    nextTickAt: string;
    tickPercent: number;
    remaining: number;
    max: number;
    limited: boolean;
  } | null;
}

export interface SyntheticLimit {
  limit: number;
  requests: number;
  renewsAt: string;
}
