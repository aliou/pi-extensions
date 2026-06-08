import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderSnapshot } from "./types";

const CACHE_DIR = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "pi",
  "providers",
);

interface CacheEntry {
  fetchedAt: string;
  data: ProviderSnapshot;
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
  } catch (_error) {
    void _error;
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
  } catch (_error) {
    void _error;
    // Ignore write errors.
  }
}

export async function getCachedProvider(
  provider: string,
): Promise<ProviderSnapshot | null> {
  const cached = await readCache(provider);
  return cached?.data ?? null;
}

export async function writeProviderCache(
  provider: string,
  data: ProviderSnapshot,
): Promise<void> {
  await writeCache(provider, data);
}
