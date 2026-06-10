import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProviderUsageSnapshot } from "@harness/provider-usage";

const CACHE_TTL_MS = 5 * 60_000;

interface UsageCacheFile {
  version: 6;
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
    if (parsed.version !== 6 || !Array.isArray(parsed.snapshots)) return null;
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
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  const body: UsageCacheFile = {
    version: 6,
    writtenAt: now.toISOString(),
    snapshots: snapshots.map(snapshotForCache),
  };
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
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
    else out[key] = reviveDates(child);
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
