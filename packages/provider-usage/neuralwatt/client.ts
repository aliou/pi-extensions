import {
  fetchJson,
  type ProviderUsageClient,
  type ProviderUsageFetchContext,
} from "../core/index";
import { normalizeNeuralwattUsage } from "./normalize";
import type { NeuralwattQuotaResponse } from "./raw-types";

const CONNECTOR_PATH = "/v1/quota";

/**
 * Neuralwatt usage is fetched through the Aperture `neuralwatt` HTTP connector
 * at `${apertureBaseUrl}/v1/connectors/neuralwatt/v1/quota`. Aperture injects
 * the upstream bearer token server-side, so no client credentials are needed.
 */
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
    const baseUrl = resolveApertureBase(ctx);
    const fetchedAt = ctx?.now ?? new Date();
    const raw = await fetchJson<NeuralwattQuotaResponse>(baseUrl, ctx, {
      headers: { Accept: "application/json" },
    });
    return normalizeNeuralwattUsage(raw, fetchedAt, baseUrl);
  },
};

function resolveApertureBase(ctx?: ProviderUsageFetchContext): string {
  const base = ctx?.apertureBaseUrl?.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Aperture base URL is not configured. Run /usage to set it up.",
    );
  }
  return `${base}/v1/connectors/neuralwatt${CONNECTOR_PATH}`;
}
