export interface NeuralwattUsageBlock {
  cost_usd: number;
  requests: number;
  tokens: number;
  energy_kwh: number;
}

export interface NeuralwattQuotaResponse {
  snapshot_at: string;
  balance?: {
    credits_remaining_usd: number;
    total_credits_usd: number;
    credits_used_usd: number;
    accounting_method?: string;
  } | null;
  usage?: {
    lifetime: NeuralwattUsageBlock;
    current_month: NeuralwattUsageBlock;
  } | null;
  limits?: {
    overage_limit_usd?: number | null;
    rate_limit_tier?: string | null;
  } | null;
  subscription?: {
    plan: string;
    status: string;
    billing_interval: string;
    current_period_start: string;
    current_period_end: string;
    auto_renew: boolean;
    kwh_included: number;
    kwh_used: number;
    kwh_remaining: number;
    in_overage: boolean;
    kwh_reset_date: string;
  } | null;
  key?: {
    name?: string | null;
    allowance?: NeuralwattKeyAllowance | null;
  } | null;
}

export interface NeuralwattKeyAllowance {
  limit_usd: number;
  used_usd: number;
  remaining_usd: number;
}
