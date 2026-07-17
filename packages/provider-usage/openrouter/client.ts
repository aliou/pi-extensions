import {
  fetchJson,
  type ProviderUsageClient,
  type ProviderUsageFetchContext,
} from "../core/index";
import { normalizeOpenRouterUsage } from "./normalize";
import type { OpenRouterKeyResponse } from "./raw-types";

const CONNECTOR_PATH = "/key";

/**
 * OpenRouter usage is fetched through the Aperture `openrouter` HTTP connector
 * at `${apertureBaseUrl}/v1/connectors/openrouter/key`. Aperture injects the
 * upstream bearer token server-side, so no client credentials are needed.
 */
export const openrouterUsageClient: ProviderUsageClient = {
  id: "openrouter",
  displayName: "OpenRouter",
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
    const raw = await fetchJson<OpenRouterKeyResponse>(baseUrl, ctx, {
      headers: { Accept: "application/json" },
    });
    return normalizeOpenRouterUsage(raw, fetchedAt, baseUrl);
  },
};

function resolveApertureBase(ctx?: ProviderUsageFetchContext): string {
  const base = ctx?.apertureBaseUrl?.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Aperture base URL is not configured. Run /usage to set it up.",
    );
  }
  return `${base}/v1/connectors/openrouter${CONNECTOR_PATH}`;
}
