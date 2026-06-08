import { getCachedProvider } from "../cache";
import type { ProviderId, ProviderSnapshot, ProviderStatus } from "../types";

export type ProviderKey = ProviderId;

export const PROVIDER_KEYS: ProviderKey[] = [
  "anthropic",
  "openai-codex",
  "synthetic",
  "neuralwatt",
];

const DISPLAY_NAMES: Record<ProviderKey, string> = {
  anthropic: "Claude",
  "openai-codex": "Codex",
  synthetic: "Synthetic",
  neuralwatt: "Neuralwatt",
};

const STATUS_URLS: Record<ProviderKey, string> = {
  anthropic: "https://status.claude.com/api/v2/status.json",
  "openai-codex": "https://status.openai.com/api/v2/status.json",
  synthetic: "https://status.synthetic.new/overview",
  neuralwatt: "https://api.neuralwatt.com/health",
};

interface StatusPageResponse {
  status?: { indicator?: string; description?: string };
}

interface NeuralwattHealthResponse {
  status?: string;
  service?: string;
  checks?: Record<string, string>;
}

function mapStatus(indicator: string | undefined): ProviderStatus {
  if (indicator === "none") return "operational";
  if (indicator === "minor") return "degraded";
  if (indicator === "major" || indicator === "critical") return "outage";
  return "unknown";
}

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

async function fetchStatusPageJson(
  url: string,
  signal?: AbortSignal,
): Promise<Pick<ProviderSnapshot, "status" | "statusMessage">> {
  const res = await fetch(url, { signal: timeoutSignal(8000, signal) });
  if (!res.ok) return { status: "unknown" };
  const raw = await res.json();
  const json = raw as StatusPageResponse;
  return {
    status: mapStatus(json.status?.indicator),
    statusMessage: json.status?.description,
  };
}

async function fetchSyntheticStatus(
  url: string,
  signal?: AbortSignal,
): Promise<Pick<ProviderSnapshot, "status" | "statusMessage">> {
  const res = await fetch(url, { signal: timeoutSignal(8000, signal) });
  if (!res.ok) return { status: "unknown" };
  const text = await res.text();
  if (/all services are online/i.test(text)) {
    return { status: "operational", statusMessage: "All services are online" };
  }
  if (/partially degraded|degraded|maintenance/i.test(text)) {
    return { status: "degraded" };
  }
  if (/down|outage|offline/i.test(text)) {
    return { status: "outage" };
  }
  return { status: "unknown" };
}

async function fetchNeuralwattStatus(
  url: string,
  signal?: AbortSignal,
): Promise<Pick<ProviderSnapshot, "status" | "statusMessage">> {
  const res = await fetch(url, { signal: timeoutSignal(8000, signal) });
  if (!res.ok) return { status: "outage", statusMessage: `HTTP ${res.status}` };
  const raw = await res.json();
  const json = raw as NeuralwattHealthResponse;
  const checks = Object.values(json.checks ?? {});
  const allHealthy =
    json.status === "healthy" && checks.every((check) => check === "healthy");
  return {
    status: allHealthy ? "operational" : "degraded",
    statusMessage: json.service,
  };
}

async function fetchProviderStatus(
  key: ProviderKey,
  signal?: AbortSignal,
): Promise<Pick<ProviderSnapshot, "status" | "statusMessage">> {
  try {
    const url = STATUS_URLS[key];
    if (key === "synthetic") return await fetchSyntheticStatus(url, signal);
    if (key === "neuralwatt") return await fetchNeuralwattStatus(url, signal);
    return await fetchStatusPageJson(url, signal);
  } catch (_error) {
    void _error;
    return { status: "unknown" };
  }
}

/**
 * Reads a single provider's cached usage data and refreshes only status.
 */
export async function fetchProvider(
  key: ProviderKey,
  signal?: AbortSignal,
): Promise<ProviderSnapshot> {
  const [cached, status] = await Promise.all([
    getCachedProvider(key),
    fetchProviderStatus(key, signal),
  ]);

  if (!cached) {
    return {
      provider: key,
      displayName: DISPLAY_NAMES[key],
      status: status.status,
      statusMessage: status.statusMessage,
      limits: [],
      error: "No cached usage data",
      fetchedAt: new Date(0),
    };
  }

  return { ...cached, ...status };
}

/**
 * Fetches all providers in parallel.
 */
export async function fetchAllProviders(
  signal?: AbortSignal,
): Promise<ProviderSnapshot[]> {
  const results = await Promise.all(
    PROVIDER_KEYS.map((key) => fetchProvider(key, signal)),
  );
  return results;
}

/**
 * Maps a model provider string to a ProviderKey, or null if unknown.
 */
export function toProviderKey(
  providerId: string | null | undefined,
): ProviderKey | null {
  if (!providerId) return null;
  const n = providerId.trim().toLowerCase();
  if (n === "anthropic") return "anthropic";
  if (n === "openai-codex") return "openai-codex";
  if (n === "synthetic") return "synthetic";
  if (n === "neuralwatt") return "neuralwatt";
  return null;
}
