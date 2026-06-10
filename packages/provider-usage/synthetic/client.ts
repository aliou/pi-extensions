import {
  fetchJson,
  getProviderApiKey,
  type ProviderUsageClient,
} from "../core/index";
import { normalizeSyntheticUsage } from "./normalize";
import type { SyntheticQuotasResponse } from "./raw-types";

const ENDPOINT = "https://api.synthetic.new/v2/quotas";

export const syntheticUsageClient: ProviderUsageClient = {
  id: "synthetic",
  displayName: "Synthetic",
  capabilities: {
    api: true,
    oauth: false,
    apiKey: true,
    responseHeaders: false,
    status: false,
  },
  async fetchUsage(ctx) {
    const key = await getProviderApiKey("synthetic", ctx);
    const fetchedAt = ctx?.now ?? new Date();
    const raw = await fetchJson<SyntheticQuotasResponse>(ENDPOINT, ctx, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
    });
    return normalizeSyntheticUsage(raw, fetchedAt);
  },
};
