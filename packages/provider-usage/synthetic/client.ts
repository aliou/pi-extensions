import {
  fetchJson,
  type ProviderUsageClient,
  type ProviderUsageFetchContext,
} from "../core/index";
import { normalizeSyntheticUsage } from "./normalize";
import type { SyntheticQuotasResponse } from "./raw-types";

const CONNECTOR_PATH = "/v2/quotas";

/**
 * Synthetic usage is fetched through the Aperture `synthetic` HTTP connector at
 * `${apertureBaseUrl}/v1/connectors/synthetic/v2/quotas`. Aperture injects the
 * upstream bearer token server-side, so no client credentials are needed.
 */
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
    const baseUrl = resolveApertureBase(ctx);
    const fetchedAt = ctx?.now ?? new Date();
    const raw = await fetchJson<SyntheticQuotasResponse>(baseUrl, ctx, {
      headers: { Accept: "application/json" },
    });
    return normalizeSyntheticUsage(raw, fetchedAt, baseUrl);
  },
};

function resolveApertureBase(ctx?: ProviderUsageFetchContext): string {
  const base = ctx?.apertureBaseUrl?.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Aperture base URL is not configured. Run /usage to set it up.",
    );
  }
  return `${base}/v1/connectors/synthetic${CONNECTOR_PATH}`;
}
