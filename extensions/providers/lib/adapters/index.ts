import type { AuthStorage } from "@earendil-works/pi-coding-agent";
import { withCache } from "../cache";
import { recordSnapshotSamples } from "../history";
import type { ProviderSnapshot } from "../types";
import type { ProviderAdapter } from "./base";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";
import { opencodeGoAdapter } from "./opencode-go";
import { syntheticAdapter } from "./synthetic";

export type ProviderKey =
  | "anthropic"
  | "openai-codex"
  | "synthetic"
  | "opencode-go";

export const PROVIDER_KEYS: ProviderKey[] = [
  "anthropic",
  "openai-codex",
  "synthetic",
  "opencode-go",
];

const adapters: Record<ProviderKey, ProviderAdapter> = {
  anthropic: claudeAdapter,
  "openai-codex": codexAdapter,
  synthetic: syntheticAdapter,
  "opencode-go": opencodeGoAdapter,
};

/**
 * Fetches a single provider's data with caching and history recording.
 */
export async function fetchProvider(
  key: ProviderKey,
  authStorage: AuthStorage,
  signal?: AbortSignal,
  force = false,
): Promise<ProviderSnapshot> {
  const adapter = adapters[key];
  const snapshot = await withCache(
    key,
    () => adapter.fetch(authStorage, signal),
    force,
  );

  // Record samples for burn rate estimation (fire-and-forget).
  if (!snapshot.error && snapshot.limits.length > 0) {
    recordSnapshotSamples(snapshot.limits).catch(() => {});
  }

  return snapshot;
}

/**
 * Fetches all providers in parallel.
 */
export async function fetchAllProviders(
  authStorage: AuthStorage,
  signal?: AbortSignal,
  force = false,
): Promise<ProviderSnapshot[]> {
  const results = await Promise.all(
    PROVIDER_KEYS.map((key) => fetchProvider(key, authStorage, signal, force)),
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
  if (n === "opencode-go") return "opencode-go";
  return null;
}
