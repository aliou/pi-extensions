export interface OpenAiCodexUsageResponse {
  user_id?: string;
  account_id?: string;
  email?: string;
  plan_type?: string;
  rate_limit?: OpenAiRateLimit | null;
  code_review_rate_limit?: OpenAiRateLimit | null;
  additional_rate_limits?: OpenAiAdditionalRateLimit[];
  credits?: OpenAiCredits | null;
  spend_control?: {
    reached?: boolean;
    individual_limit?: string | number | null;
  } | null;
  rate_limit_reached_type?: string | null;
}

export interface OpenAiRateLimit {
  allowed: boolean;
  limit_reached: boolean;
  primary_window?: OpenAiWindow | null;
  secondary_window?: OpenAiWindow | null;
}

export interface OpenAiWindow {
  used_percent: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
}

export interface OpenAiAdditionalRateLimit {
  limit_name: string;
  metered_feature?: string;
  rate_limit: OpenAiRateLimit;
}

export interface OpenAiCredits {
  has_credits: boolean;
  unlimited: boolean;
  overage_limit_reached: boolean;
  balance: string;
}

export interface OpenAiCodexResetCreditsResponse {
  available_count: number;
  credits: OpenAiCodexResetCredit[];
}

export interface OpenAiCodexResetCredit {
  id: string;
  reset_type: string;
  status: string;
  granted_at: string;
  expires_at?: string | null;
}
