/**
 * Shape of the OpenRouter `/api/v1/key` endpoint, served through the Aperture
 * `openrouter` connector at `/v1/connectors/openrouter/key`.
 *
 * All usage/limit amounts are USD credits.
 */
export interface OpenRouterKeyResponse {
  data: {
    label: string;
    /** Credit limit for the key, or null if unlimited. */
    limit: number | null;
    /** Type of limit reset for the key ("monthly" for our keys), or null if never resets. */
    limit_reset: string | null;
    /** Remaining credits for the key, or null if unlimited. */
    limit_remaining: number | null;
    /** Whether to include external BYOK usage in the credit limit. */
    include_byok_in_limit: boolean;

    /** Credits used, all time. */
    usage: number;
    /** Credits used, current UTC day. */
    usage_daily: number;
    /** Credits used, current UTC week (starting Monday). */
    usage_weekly: number;
    /** Credits used, current UTC month. */
    usage_monthly: number;

    /** Same, for external BYOK usage. */
    byok_usage: number;
    byok_usage_daily: number;
    byok_usage_weekly: number;
    byok_usage_monthly: number;

    /** Whether the user has paid for credits before. */
    is_free_tier: boolean;
    // `rate_limit`: deprecated object in the response, safe to ignore.
  };
}
