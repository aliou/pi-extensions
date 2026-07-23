import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const CACHE_REFRESH_INTERVAL_MS = 30_000;
export const SYNTHETIC_CACHE_TTL_MS = 10 * MINUTE_MS;
export const OPENAI_SHORT_CACHE_TTL_MS = 10 * MINUTE_MS;
export const NEURALWATT_KIMI_CACHE_TTL_MS = 5 * MINUTE_MS;
export const NEURALWATT_GLM_CACHE_TTL_MS = HOUR_MS;
export const NEURALWATT_DEFAULT_CACHE_TTL_MS = 30 * MINUTE_MS;
export const ANTHROPIC_SHORT_CACHE_TTL_MS = 5 * MINUTE_MS;
export const ANTHROPIC_LONG_CACHE_TTL_MS = HOUR_MS;
export const OPENAI_LONG_CACHE_TTL_MS = 24 * HOUR_MS;

export type CacheFreshness = {
  state: "valid" | "stale" | "unknown";
  ageMs?: number;
  ttlMs?: number;
  provider?: string;
  model?: string;
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
  const identity = {
    provider: anchor.message.provider,
    model: anchor.message.model,
  };

  if (ttlMs === undefined) return { state: "unknown", ageMs, ...identity };

  return {
    state: ageMs <= ttlMs ? "valid" : "stale",
    ageMs,
    ttlMs,
    ...identity,
  };
}

export function formatCacheRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h${restMinutes}m`;
}
