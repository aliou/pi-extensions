export interface AnthropicOAuthUsageResponse {
  five_hour?: AnthropicPercentWindow | null;
  seven_day?: AnthropicPercentWindow | null;
  seven_day_oauth_apps?: AnthropicPercentWindow | null;
  seven_day_opus?: AnthropicPercentWindow | null;
  seven_day_sonnet?: AnthropicPercentWindow | null;
  seven_day_cowork?: AnthropicPercentWindow | null;
  seven_day_omelette?: AnthropicPercentWindow | null;
  tangelo?: AnthropicPercentWindow | null;
  iguana_necktie?: AnthropicPercentWindow | null;
  omelette_promotional?: AnthropicPercentWindow | null;
  cinder_cove?: AnthropicPercentWindow | null;
  extra_usage?: AnthropicExtraUsage | null;
}

export interface AnthropicPercentWindow {
  utilization: number;
  resets_at: string | null;
}

export interface AnthropicExtraUsage {
  is_enabled: boolean;
  monthly_limit: number;
  used_credits: number;
  utilization: number;
  currency: string;
  disabled_reason: string | null;
}
