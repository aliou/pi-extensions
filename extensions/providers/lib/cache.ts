import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderSnapshot } from "./types";

const CACHE_DIR = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "pi",
  "providers",
);

const FRESH_TTL_MS = 5 * 60 * 1000;
const STALE_IF_ERROR_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: string;
  data: ProviderSnapshot;
}

function ageMs(fetchedAt: string): number | null {
  const d = new Date(fetchedAt);
  if (Number.isNaN(d.getTime())) return null;
  return Date.now() - d.getTime();
}

function rehydrateDates(snapshot: ProviderSnapshot): ProviderSnapshot {
  return {
    ...snapshot,
    fetchedAt: new Date(snapshot.fetchedAt),
    limits: snapshot.limits.map((limit) => {
      if (limit.kind === "fixed-window") {
        return {
          ...limit,
          updatedAt: new Date(limit.updatedAt),
          resetsAt: limit.resetsAt ? new Date(limit.resetsAt) : null,
        };
      }
      if (limit.kind === "refillable") {
        return {
          ...limit,
          updatedAt: new Date(limit.updatedAt),
          nextRefillAt: new Date(limit.nextRefillAt),
        };
      }
      // regen-budget
      return {
        ...limit,
        updatedAt: new Date(limit.updatedAt),
        nextRegenAt: limit.nextRegenAt ? new Date(limit.nextRegenAt) : null,
      };
    }),
  };
}

async function readCache(provider: string): Promise<CacheEntry | null> {
  try {
    const raw = await readFile(join(CACHE_DIR, `${provider}.json`), "utf-8");
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.fetchedAt || !parsed?.data) return null;
    return { ...parsed, data: rehydrateDates(parsed.data) };
  } catch {
    return null;
  }
}

async function writeCache(
  provider: string,
  data: ProviderSnapshot,
): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { fetchedAt: new Date().toISOString(), data };
    await writeFile(
      join(CACHE_DIR, `${provider}.json`),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore write errors.
  }
}

/**
 * Wraps a provider fetch with filesystem caching.
 * Returns fresh cache if available, otherwise fetches. On fetch error, returns
 * stale cache if within the stale window.
 *
 * Pass `force: true` to skip the fresh cache check and always fetch.
 */
export async function withCache(
  provider: string,
  fetchFn: () => Promise<ProviderSnapshot>,
  force = false,
): Promise<ProviderSnapshot> {
  const cached = await readCache(provider);

  if (!force && cached) {
    const age = ageMs(cached.fetchedAt);
    if (age !== null && age < FRESH_TTL_MS) {
      return cached.data;
    }
  }

  const result = await fetchFn();

  if (!result.error) {
    await writeCache(provider, result);
    return result;
  }

  // On error, prefer stale cache over error result.
  if (cached) {
    const age = ageMs(cached.fetchedAt);
    if (age !== null && age < STALE_IF_ERROR_MS) {
      return cached.data;
    }
  }

  return result;
}
