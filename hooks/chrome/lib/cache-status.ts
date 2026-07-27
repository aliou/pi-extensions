import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

// OpenAI pre-GPT-5.6: typical in-memory eviction is 5-10m; extended retention up to 24h.
// https://developers.openai.com/api/docs/guides/prompt-caching
export const OPENAI_SHORT_CACHE_TTL_MS = 10 * MINUTE_MS;
export const OPENAI_LONG_CACHE_TTL_MS = 24 * HOUR_MS;
// GPT-5.6+ explicit caching only supports a 30m TTL.
// https://developers.openai.com/api/docs/guides/prompt-caching (2026-07)
export const OPENAI_GPT56_CACHE_TTL_MS = 30 * MINUTE_MS;
export const NEURALWATT_KIMI_CACHE_TTL_MS = 5 * MINUTE_MS;
export const NEURALWATT_GLM_CACHE_TTL_MS = HOUR_MS;
export const NEURALWATT_DEFAULT_CACHE_TTL_MS = 30 * MINUTE_MS;
// Anthropic cache_control defaults to 5m; ttl: "1h" extends to 1h.
// https://platform.claude.com/docs/en/build-with-claude/prompt-caching
export const ANTHROPIC_SHORT_CACHE_TTL_MS = 5 * MINUTE_MS;
export const ANTHROPIC_LONG_CACHE_TTL_MS = HOUR_MS;
// OpenRouter mirrors upstream cache semantics per vendor.
// https://openrouter.ai/docs/guides/best-practices/prompt-caching
export const OPENROUTER_ANTHROPIC_SHORT_CACHE_TTL_MS = 5 * MINUTE_MS;
export const OPENROUTER_ANTHROPIC_LONG_CACHE_TTL_MS = HOUR_MS;
export const OPENROUTER_QWEN_CACHE_TTL_MS = 5 * MINUTE_MS;

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

function isOpenAiGpt56OrLater(model: string): boolean {
  const match = /gpt-(\d+)\.(\d+)/i.exec(model);
  if (!match) return false;
  const major = parseInt(match[1] ?? "0", 10);
  const minor = parseInt(match[2] ?? "0", 10);
  return major > 5 || (major === 5 && minor >= 6);
}

function getOpenAiTtlMs(
  api: string,
  provider: string,
  model: string,
  cacheRetention: string | undefined,
): number | undefined {
  const isOpenAiFamily =
    api === "openai-completions" ||
    api === "openai-responses" ||
    api === "openai-codex-responses" ||
    provider === "openai-codex";
  if (!isOpenAiFamily) return undefined;

  // GPT-5.6+ explicit caching hardcodes a 30m TTL.
  if (isOpenAiGpt56OrLater(model)) {
    return OPENAI_GPT56_CACHE_TTL_MS;
  }

  const longRetention = cacheRetention === "long";
  if (
    longRetention &&
    (api === "openai-completions" || api === "openai-responses")
  ) {
    return OPENAI_LONG_CACHE_TTL_MS;
  }

  return OPENAI_SHORT_CACHE_TTL_MS;
}

function getOpenRouterTtlMs(
  api: string,
  model: string,
  cacheRetention: string | undefined,
): number | undefined {
  const slashIndex = model.indexOf("/");
  if (slashIndex < 0) return undefined;

  const vendor = model.slice(0, slashIndex);
  const rest = model.slice(slashIndex + 1);

  if (vendor === "anthropic") {
    const longRetention = cacheRetention === "long";
    return longRetention
      ? OPENROUTER_ANTHROPIC_LONG_CACHE_TTL_MS
      : OPENROUTER_ANTHROPIC_SHORT_CACHE_TTL_MS;
  }

  if (vendor === "openai") {
    // OpenRouter OpenAI models follow the same TTL rules as direct OpenAI.
    return getOpenAiTtlMs(api, "openai", rest, cacheRetention);
  }

  if (vendor === "qwen" || vendor === "alibaba") {
    return OPENROUTER_QWEN_CACHE_TTL_MS;
  }

  // Google/Gemini via OpenRouter uses automatic caching with no documented fixed TTL.
  // Reporting "unknown" is more accurate than guessing.
  if (vendor === "google" || vendor === "gemini") {
    return undefined;
  }

  return undefined;
}

function getKnownTtlMs(
  message: AssistantMessage,
  cacheRetention = process.env.PI_CACHE_RETENTION,
): number | undefined {
  const api = message.api ?? "";
  const provider = message.provider.toLowerCase();
  const model = message.model.toLowerCase();

  if (
    provider === "synthetic" ||
    model.startsWith("syn:") ||
    model.startsWith("hf:")
  ) {
    // Synthetic has no fixed cache TTL; cache liveness is LRU-driven per node.
    // https://github.com/aliou/pi-synthetic/blob/main/README.md
    return undefined;
  }

  if (provider === "neuralwatt") {
    if (model.startsWith("kimi-")) return NEURALWATT_KIMI_CACHE_TTL_MS;
    if (model.startsWith("glm-")) return NEURALWATT_GLM_CACHE_TTL_MS;
    return NEURALWATT_DEFAULT_CACHE_TTL_MS;
  }

  if (provider === "openrouter") {
    return getOpenRouterTtlMs(api, model, cacheRetention);
  }

  const openAiTtl = getOpenAiTtlMs(api, provider, model, cacheRetention);
  if (openAiTtl !== undefined) return openAiTtl;

  const longRetention = cacheRetention === "long";
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

  if (ttlMs === undefined) {
    return { state: "unknown", ageMs };
  }

  return {
    state: ageMs <= ttlMs ? "valid" : "stale",
    ageMs,
    ttlMs,
  };
}
