import {
  fetchJson,
  getProviderApiKey,
  type ProviderUsageClient,
} from "../core/index";
import { normalizeAnthropicUsage } from "./normalize";
import type { AnthropicOAuthUsageResponse } from "./raw-types";

const ENDPOINT = "https://api.anthropic.com/api/oauth/usage";

export const anthropicUsageClient: ProviderUsageClient = {
  id: "anthropic",
  displayName: "Anthropic",
  capabilities: {
    api: true,
    oauth: true,
    apiKey: false,
    responseHeaders: false,
    status: false,
  },
  async fetchUsage(ctx) {
    const token = await getProviderApiKey("anthropic", ctx);
    const fetchedAt = ctx?.now ?? new Date();
    const raw = await fetchJson<AnthropicOAuthUsageResponse>(ENDPOINT, ctx, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "claude-code/2.1.0",
      },
    });
    return normalizeAnthropicUsage(raw, fetchedAt);
  },
};
