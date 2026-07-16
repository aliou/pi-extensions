import {
  appendUsageHistory,
  buildProjectionHints,
  readUsageCache,
  writeUsageCache,
} from "@harness/models/usage";
import {
  getApertureBaseUrl,
  type ProviderUsageClient,
  type ProviderUsageFetchContext,
  ProviderUsageHttpError,
  type ProviderUsageSnapshot,
  providerUsageClients,
} from "@harness/provider-usage";
import { setProjectionHints } from "./projections";
import type { UsageDashboard } from "./types";

export interface LoadUsageOptions {
  getProviderApiKey?: ProviderUsageFetchContext["getProviderApiKey"];
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export async function loadUsageDashboard(
  options: LoadUsageOptions,
): Promise<UsageDashboard> {
  const now = new Date();
  const cache = await readUsageCache(now);
  if (
    cache?.fresh &&
    !options.forceRefresh &&
    !hasHeaderOnlySnapshot(cache.snapshots)
  ) {
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

function hasHeaderOnlySnapshot(snapshots: ProviderUsageSnapshot[]): boolean {
  return snapshots.some(
    (snapshot) =>
      snapshot.source.kind === "response-header" &&
      !snapshot.account?.id &&
      !snapshot.account?.email,
  );
}

async function fetchAllProviderSnapshots(
  options: LoadUsageOptions,
): Promise<ProviderUsageSnapshot[]> {
  const apertureBaseUrl = getApertureBaseUrl();
  const snapshots = await Promise.all(
    providerUsageClients.map((client) =>
      safeFetchProvider(client, options, apertureBaseUrl),
    ),
  );
  return Promise.all(
    snapshots.map((snapshot) => withProviderStatus(snapshot, options.signal)),
  );
}

async function safeFetchProvider(
  client: ProviderUsageClient,
  options: LoadUsageOptions,
  apertureBaseUrl: string | undefined,
): Promise<ProviderUsageSnapshot> {
  const fetchedAt = new Date();
  try {
    return await client.fetchUsage({
      getProviderApiKey: options.getProviderApiKey,
      signal: options.signal,
      timeoutMs: 10_000,
      apertureBaseUrl,
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
  if (error instanceof ProviderUsageHttpError) {
    const detail = formatHttpErrorBody(error.body);
    return detail ? `${error.message} — ${detail}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Extract a short human-readable reason from a failed provider HTTP body. */
function formatHttpErrorBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed ? truncate(trimmed) : undefined;
  }
  const obj = body as { error?: { message?: unknown }; message?: unknown };
  const message = obj?.error?.message ?? obj?.message;
  if (typeof message === "string") return truncate(message.trim());
  try {
    return truncate(JSON.stringify(body));
  } catch {
    return undefined;
  }
}

function truncate(value: string): string {
  return value.length > 220 ? `${value.slice(0, 220)}…` : value;
}
