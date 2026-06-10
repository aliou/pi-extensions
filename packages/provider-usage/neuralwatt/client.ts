import {
  fetchJson,
  getProviderApiKey,
  type ProviderUsageClient,
} from "../core/index";
import { normalizeNeuralwattUsage } from "./normalize";
import type { NeuralwattQuotaResponse } from "./raw-types";

const ENDPOINT = "https://api.neuralwatt.com/v1/quota";

export const neuralwattUsageClient: ProviderUsageClient = {
  id: "neuralwatt",
  displayName: "Neuralwatt",
  capabilities: {
    api: true,
    oauth: false,
    apiKey: true,
    responseHeaders: false,
    status: true,
  },
  async fetchUsage(ctx) {
    const key = await getProviderApiKey("neuralwatt", ctx);
    const fetchedAt = ctx?.now ?? new Date();
    const raw = await fetchJson<NeuralwattQuotaResponse>(ENDPOINT, ctx, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
    });
    return normalizeNeuralwattUsage(raw, fetchedAt);
  },
};
