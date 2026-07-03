import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const SYNTHETIC_CACHE_TTL_MS = 10 * MINUTE_MS;
export const OPENAI_SHORT_CACHE_TTL_MS = 10 * MINUTE_MS;
export const NEURALWATT_KIMI_CACHE_TTL_MS = 5 * MINUTE_MS;
export const NEURALWATT_GLM_CACHE_TTL_MS = HOUR_MS;
export const NEURALWATT_DEFAULT_CACHE_TTL_MS = 30 * MINUTE_MS;
export const ANTHROPIC_SHORT_CACHE_TTL_MS = 5 * MINUTE_MS;
export const ANTHROPIC_LONG_CACHE_TTL_MS = HOUR_MS;
export const OPENAI_LONG_CACHE_TTL_MS = 24 * HOUR_MS;

export type CacheFreshnessState = "valid" | "stale" | "unknown";

export type CacheFreshness = {
  state: CacheFreshnessState;
  ageMs?: number;
  ttlMs?: number;
};

type AssistantAnchor = {
  entry: SessionEntry;
  message: AssistantMessage;
};

function findLastAssistant(
  entries: readonly SessionEntry[],
): AssistantAnchor | "compacted" | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type === "compaction") return "compacted";
    if (entry?.type === "message" && entry.message.role === "assistant") {
      return { entry, message: entry.message };
    }
  }

  return undefined;
}

function getAnchorTimestampMs(anchor: AssistantAnchor): number | undefined {
  const entryTimestampMs = Date.parse(anchor.entry.timestamp);
  if (Number.isFinite(entryTimestampMs)) return entryTimestampMs;
  return Number.isFinite(anchor.message.timestamp)
    ? anchor.message.timestamp
    : undefined;
}

function getKnownTtlMs(
  message: AssistantMessage,
  cacheRetention = process.env.PI_CACHE_RETENTION,
): number | undefined {
  const api = message.api ?? "";
  const provider = message.provider.toLowerCase();
  const model = message.model.toLowerCase();
  const longRetention = cacheRetention === "long";

  if (
    provider === "synthetic" ||
    model.startsWith("syn:") ||
    model.startsWith("hf:")
  ) {
    return SYNTHETIC_CACHE_TTL_MS;
  }

  if (provider === "neuralwatt") {
    if (model.startsWith("kimi-")) return NEURALWATT_KIMI_CACHE_TTL_MS;
    if (model.startsWith("glm-")) return NEURALWATT_GLM_CACHE_TTL_MS;
    return NEURALWATT_DEFAULT_CACHE_TTL_MS;
  }

  if (
    longRetention &&
    (api === "openai-completions" || api === "openai-responses")
  ) {
    return OPENAI_LONG_CACHE_TTL_MS;
  }

  if (
    api === "openai-completions" ||
    api === "openai-responses" ||
    api === "openai-codex-responses" ||
    provider === "openai-codex"
  ) {
    return OPENAI_SHORT_CACHE_TTL_MS;
  }

  if (
    longRetention &&
    (api === "anthropic-messages" || api === "bedrock-converse-stream")
  ) {
    return ANTHROPIC_LONG_CACHE_TTL_MS;
  }

  if (api === "anthropic-messages" || api === "bedrock-converse-stream") {
    return ANTHROPIC_SHORT_CACHE_TTL_MS;
  }

  return undefined;
}

/**
 * Format how long ago a cache expired as a compact, rounded relative string.
 *
 * Granularity coarsens with magnitude:
 *   < 1m   -> "45s"
 *   < 1h   -> "10m"
 *   < 24h  -> "23h"
 *   >= 24h -> "1d12h", "2d", ...
 *
 * For multi-day values the hour remainder is rounded to the nearest hour and
 * shown alongside the day count, except when it is within an hour of the
 * next day (>= 23h), in which case it rolls up to the next whole day. This
 * keeps "1d12h" readable while turning "1d23h" into "2d".
 */
export function formatExpiredSince(sinceMs: number): string {
  const totalSeconds = Math.max(0, Math.round(sinceMs / SECOND_MS));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours - days * 24;
  if (remHours >= 23) return `${days + 1}d`;
  if (remHours === 0) return `${days}d`;
  return `${days}d${remHours}h`;
}

export function getCacheFreshness(
  entries: readonly SessionEntry[],
  nowMs = Date.now(),
  cacheRetention = process.env.PI_CACHE_RETENTION,
): CacheFreshness | undefined {
  const anchor = findLastAssistant(entries);
  if (!anchor) return undefined;
  if (anchor === "compacted") return { state: "unknown" };

  const timestampMs = getAnchorTimestampMs(anchor);
  if (timestampMs === undefined) return undefined;

  const ttlMs = getKnownTtlMs(anchor.message, cacheRetention);
  const ageMs = Math.max(0, nowMs - timestampMs);

  if (ttlMs === undefined) {
    return { state: "unknown", ageMs };
  }

  return {
    state: ageMs <= ttlMs ? "valid" : "stale",
    ageMs,
    ttlMs,
  };
}
