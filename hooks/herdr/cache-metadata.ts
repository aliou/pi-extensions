import type { CacheFreshness } from "./cache-status";
import { formatCacheRemaining } from "./cache-status";

export type ActiveModelIdentity = {
  provider: string;
  id: string;
};

export type CacheMetadata = {
  value: string | null;
  ttlMs?: number;
};

export function buildCacheMetadata(
  freshness: CacheFreshness | undefined,
  activeModel: ActiveModelIdentity | undefined,
): CacheMetadata {
  if (
    freshness?.state !== "valid" ||
    freshness.ageMs === undefined ||
    freshness.ttlMs === undefined ||
    !activeModel ||
    freshness.provider !== activeModel.provider ||
    freshness.model !== activeModel.id
  ) {
    return { value: null };
  }

  const remainingMs = freshness.ttlMs - freshness.ageMs;
  if (remainingMs <= 0) return { value: null };

  return {
    value: `≡ ${formatCacheRemaining(remainingMs)}`,
    ttlMs: Math.max(1, Math.ceil(remainingMs)),
  };
}
