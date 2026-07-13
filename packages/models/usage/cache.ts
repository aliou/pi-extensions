import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ProviderUsageObservation,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";

const CACHE_TTL_MS = 5 * 60_000;
let pendingCacheWrite = Promise.resolve();

interface UsageCacheFile {
  version: 7;
  writtenAt: string;
  snapshots: unknown[];
}

export interface UsageCacheResult {
  snapshots: ProviderUsageSnapshot[];
  writtenAt: Date;
  fresh: boolean;
}

export async function readUsageCache(
  now = new Date(),
): Promise<UsageCacheResult | null> {
  try {
    const cacheText = await readFile(cachePath(), "utf8");
    const parsed = JSON.parse(cacheText) as UsageCacheFile;
    if (parsed.version !== 7 || !Array.isArray(parsed.snapshots)) return null;
    const writtenAt = new Date(parsed.writtenAt);
    return {
      snapshots: reviveDates(parsed.snapshots) as ProviderUsageSnapshot[],
      writtenAt,
      fresh: now.getTime() - writtenAt.getTime() <= CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

export async function writeUsageCache(
  snapshots: ProviderUsageSnapshot[],
  now = new Date(),
): Promise<void> {
  return enqueueCacheWrite(async () => {
    const current = await readUsageCache(now);
    await writeUsageCacheFile(
      mergeNewerHeaderObservations(current?.snapshots ?? [], snapshots),
      now,
    );
  });
}

async function writeUsageCacheFile(
  snapshots: ProviderUsageSnapshot[],
  now: Date,
): Promise<void> {
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  const body: UsageCacheFile = {
    version: 7,
    writtenAt: now.toISOString(),
    snapshots: snapshots.map(snapshotForCache),
  };
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

export async function applyUsageObservationToCache(
  observation: ProviderUsageObservation,
  now = new Date(),
): Promise<void> {
  return enqueueCacheWrite(async () => {
    const cache = await readUsageCache(now);
    if (
      !cache?.snapshots.some(
        (snapshot) => snapshot.provider === observation.provider,
      )
    ) {
      return;
    }
    await writeUsageCacheFile(
      mergeUsageObservation(cache.snapshots, observation),
      now,
    );
  });
}

export function mergeUsageObservation(
  snapshots: ProviderUsageSnapshot[],
  observation: ProviderUsageObservation,
): ProviderUsageSnapshot[] {
  const existing = snapshots.find(
    (snapshot) => snapshot.provider === observation.provider,
  );
  if (!existing) return snapshots;
  const next = mergeSnapshot(existing, observation);
  return snapshots.map((snapshot) =>
    snapshot.provider === observation.provider ? next : snapshot,
  );
}

function mergeSnapshot(
  snapshot: ProviderUsageSnapshot,
  observation: ProviderUsageObservation,
): ProviderUsageSnapshot {
  return {
    ...snapshot,
    displayName: observation.displayName ?? snapshot.displayName,
    fetchedAt: observation.observedAt,
    status: mergeDefined(snapshot.status, observation.status),
    account: mergeDefined(snapshot.account, observation.account),
    quotas: mergeQuotas(snapshot.quotas, observation.quotas),
    source: observation.source,
  };
}

function mergeNewerHeaderObservations(
  current: ProviderUsageSnapshot[],
  incoming: ProviderUsageSnapshot[],
): ProviderUsageSnapshot[] {
  return incoming.map((snapshot) => {
    const live = current.find(
      (candidate) =>
        candidate.provider === snapshot.provider &&
        candidate.source.kind === "response-header" &&
        candidate.fetchedAt.getTime() > snapshot.fetchedAt.getTime(),
    );
    if (!live) return snapshot;
    const liveQuotas = live.quotas.filter(
      (quota) => quota.source.kind === "response-header",
    );
    return {
      ...snapshot,
      fetchedAt: live.fetchedAt,
      status: mergeDefined(snapshot.status, live.status),
      account: mergeDefined(snapshot.account, live.account),
      quotas: mergeQuotas(snapshot.quotas, liveQuotas),
      source: live.source,
    };
  });
}

function mergeQuotas(
  current: UsageQuota[],
  observed: UsageQuota[],
): UsageQuota[] {
  const observations = new Map(observed.map((quota) => [quota.id, quota]));
  const merged = current.map((quota) => {
    const observation = observations.get(quota.id);
    return observation ? mergeQuota(quota, observation) : quota;
  });
  for (const observation of observed) {
    if (!current.some((quota) => quota.id === observation.id)) {
      merged.push(observation);
    }
  }
  return merged;
}

function mergeQuota(current: UsageQuota, observed: UsageQuota): UsageQuota {
  return {
    ...current,
    ...observed,
    amount: mergeDefined(current.amount, observed.amount) ?? observed.amount,
    period: mergeDefined(current.period, observed.period) ?? observed.period,
    replenishment:
      observed.replenishment.kind === "full-reset" &&
      observed.replenishment.at === null
        ? current.replenishment
        : observed.replenishment,
    state: mergeDefined(current.state, observed.state),
    raw: observed.raw ?? current.raw,
  };
}

function mergeDefined<T extends object>(
  current: T | undefined,
  observed: T | undefined,
): T | undefined {
  if (!current) return observed;
  if (!observed) return current;
  return Object.fromEntries(
    [...Object.entries(current), ...Object.entries(observed)].filter(
      ([, value]) => value !== undefined,
    ),
  ) as T;
}

function enqueueCacheWrite(operation: () => Promise<void>): Promise<void> {
  const next = pendingCacheWrite.then(operation);
  pendingCacheWrite = next.catch(() => undefined);
  return next;
}

function cachePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "pi-harness", "provider-usage", "cache.json");
}

function snapshotForCache(snapshot: ProviderUsageSnapshot): unknown {
  return snapshot;
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (!value || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && isDateKey(key)) out[key] = new Date(child);
    else if (key === "expirationDates" && Array.isArray(child)) {
      out[key] = child.map((date) =>
        typeof date === "string" ? new Date(date) : date,
      );
    } else out[key] = reviveDates(child);
  }
  return out;
}

function isDateKey(key: string): boolean {
  return (
    key === "fetchedAt" ||
    key === "updatedAt" ||
    key === "startsAt" ||
    key === "endsAt" ||
    key === "at" ||
    key === "nextAt" ||
    key === "writtenAt"
  );
}
