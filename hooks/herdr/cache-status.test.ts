import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_LONG_CACHE_TTL_MS,
  getCacheFreshness,
  NEURALWATT_GLM_CACHE_TTL_MS,
  NEURALWATT_KIMI_CACHE_TTL_MS,
  OPENAI_SHORT_CACHE_TTL_MS,
  SYNTHETIC_CACHE_TTL_MS,
} from "./cache-status";

function assistantEntry(options: {
  provider: string;
  model: string;
  api: string;
  timestampMs?: number;
}): SessionEntry {
  const timestampMs = options.timestampMs ?? 10_000;
  return {
    type: "message",
    id: "assistant-entry",
    parentId: null,
    timestamp: new Date(timestampMs).toISOString(),
    message: {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
      provider: options.provider,
      model: options.model,
      api: options.api,
      timestamp: timestampMs,
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
    },
  };
}

describe("Herdr cache freshness", () => {
  it.each([
    [
      "synthetic",
      "hf:model",
      "openai-completions",
      SYNTHETIC_CACHE_TTL_MS,
      "short",
    ],
    [
      "openai-codex",
      "gpt-5.6",
      "openai-codex-responses",
      OPENAI_SHORT_CACHE_TTL_MS,
      "short",
    ],
    [
      "neuralwatt",
      "kimi-k2.7-code",
      "openai-completions",
      NEURALWATT_KIMI_CACHE_TTL_MS,
      "short",
    ],
    [
      "neuralwatt",
      "glm-5.2-short",
      "openai-completions",
      NEURALWATT_GLM_CACHE_TTL_MS,
      "short",
    ],
    [
      "anthropic",
      "claude-opus-4-6",
      "anthropic-messages",
      ANTHROPIC_LONG_CACHE_TTL_MS,
      "long",
    ],
  ])("uses the known TTL for %s/%s", (provider, model, api, expectedTtlMs, retention) => {
    const status = getCacheFreshness(
      [assistantEntry({ provider, model, api })],
      10_001,
      retention,
    );

    expect(status).toMatchObject({
      state: "valid",
      ttlMs: expectedTtlMs,
      provider,
      model,
    });
  });

  it("returns unknown when compaction follows the cache anchor", () => {
    const assistant = assistantEntry({
      provider: "openai-codex",
      model: "gpt-5.6",
      api: "openai-codex-responses",
    });
    const compaction: SessionEntry = {
      type: "compaction",
      id: "compaction-entry",
      parentId: assistant.id,
      timestamp: new Date(20_000).toISOString(),
      summary: "summary",
      firstKeptEntryId: assistant.id,
      tokensBefore: 10_000,
    };

    expect(getCacheFreshness([assistant, compaction])).toEqual({
      state: "unknown",
    });
  });
});
