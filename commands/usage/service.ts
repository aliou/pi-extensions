import {
  appendUsageHistory,
  buildProjectionHints,
  readUsageCache,
  writeUsageCache,
} from "@harness/models/usage";
import {
  type ProviderUsageClient,
  type ProviderUsageFetchContext,
  type ProviderUsageSnapshot,
  providerUsageClients,
} from "@harness/provider-usage";
import { setProjectionHints } from "./projections";
import type { UsageDashboard } from "./types";

export interface LoadUsageOptions {
  authStorage?: ProviderUsageFetchContext["authStorage"];
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export async function loadUsageDashboard(
  options: LoadUsageOptions,
): Promise<UsageDashboard> {
  const now = new Date();
  const cache = await readUsageCache(now);
  if (cache?.fresh && !options.forceRefresh) {
    const hints = await buildProjectionHints(cache.snapshots);
    setProjectionHints(hints);
    return {
      snapshots: cache.snapshots,
      fromCache: true,
      stale: false,
      refreshedAt: cache.writtenAt,
    };
  }

  const snapshots = await fetchAllProviderSnapshots(options);
  const usableSnapshots = mergeFailedWithCache(
    snapshots,
    cache?.snapshots ?? [],
  );
  const hints = await buildProjectionHints(usableSnapshots);
  setProjectionHints(hints);
  await writeUsageCache(usableSnapshots, now).catch(() => undefined);
  await appendUsageHistory(usableSnapshots).catch(() => undefined);

  return {
    snapshots: usableSnapshots,
    fromCache: false,
    stale: false,
    refreshedAt: now,
  };
}

async function fetchAllProviderSnapshots(
  options: LoadUsageOptions,
): Promise<ProviderUsageSnapshot[]> {
  const snapshots = await Promise.all(
    providerUsageClients.map((client) => safeFetchProvider(client, options)),
  );
  return Promise.all(
    snapshots.map((snapshot) => withProviderStatus(snapshot, options.signal)),
  );
}

async function safeFetchProvider(
  client: ProviderUsageClient,
  options: LoadUsageOptions,
): Promise<ProviderUsageSnapshot> {
  const fetchedAt = new Date();
  try {
    return await client.fetchUsage({
      authStorage: options.authStorage,
      signal: options.signal,
      timeoutMs: 10_000,
    });
  } catch (error) {
    return {
      provider: client.id,
      displayName: client.displayName,
      fetchedAt,
      status: { available: false, message: errorMessage(error) },
      quotas: [],
      source: { kind: "api", fetchedAt },
      errors: [{ code: "fetch_failed", message: errorMessage(error) }],
    };
  }
}

function mergeFailedWithCache(
  fetched: ProviderUsageSnapshot[],
  cached: ProviderUsageSnapshot[],
): ProviderUsageSnapshot[] {
  return fetched.map((snapshot) => {
    if (!snapshot.errors?.length || snapshot.quotas.length > 0) return snapshot;
    const cachedSnapshot = cached.find(
      (item) => item.provider === snapshot.provider,
    );
    if (!cachedSnapshot) return snapshot;
    return {
      ...cachedSnapshot,
      errors: snapshot.errors,
      status: {
        ...cachedSnapshot.status,
        message: snapshot.errors[0]?.message,
      },
    };
  });
}

async function withProviderStatus(
  snapshot: ProviderUsageSnapshot,
  signal: AbortSignal | undefined,
): Promise<ProviderUsageSnapshot> {
  if (snapshot.errors?.length && snapshot.quotas.length === 0) return snapshot;
  if (snapshot.provider === "anthropic") {
    const status = await fetchStatusPage(
      "https://status.claude.com",
      signal,
    ).catch(() => null);
    if (!status) return snapshot;
    return { ...snapshot, status: { ...snapshot.status, ...status } };
  }
  if (snapshot.provider === "synthetic" && !snapshot.status) {
    return { ...snapshot, status: { available: true } };
  }
  return snapshot;
}

async function fetchStatusPage(
  baseUrl: string,
  signal: AbortSignal | undefined,
): Promise<ProviderUsageSnapshot["status"]> {
  const response = await fetch(`${baseUrl}/api/v2/status.json`, { signal });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const json = await response.json();
  const body = json as {
    status?: { indicator?: string; description?: string };
  };
  const indicator = body.status?.indicator;
  return {
    available: indicator === "none",
    limited: indicator === "minor" || indicator === "major",
    blocked: indicator === "critical",
    message: body.status?.description,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
