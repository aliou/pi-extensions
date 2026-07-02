import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_SHORT_CACHE_TTL_MS,
  getCacheFreshness,
  NEURALWATT_GLM_CACHE_TTL_MS,
  NEURALWATT_KIMI_CACHE_TTL_MS,
  OPENAI_LONG_CACHE_TTL_MS,
  OPENAI_SHORT_CACHE_TTL_MS,
  SYNTHETIC_CACHE_TTL_MS,
} from "./cache-status";

function compactionEntry(timestampMs: number): SessionEntry {
  return {
    type: "compaction",
    id: "compaction-entry",
    parentId: "assistant-entry",
    timestamp: new Date(timestampMs).toISOString(),
    summary: "summary",
    firstKeptEntryId: "assistant-entry",
    tokensBefore: 10_000,
  };
}

function assistantEntry(overrides: {
  timestampMs: number;
  provider?: string;
  model?: string;
  api?: string;
}): SessionEntry {
  const input = 100;
  const output = 20;
  return {
    type: "message",
    id: "assistant-entry",
    parentId: null,
    timestamp: new Date(overrides.timestampMs).toISOString(),
    message: {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
      api: overrides.api ?? "openai-completions",
      provider: overrides.provider ?? "synthetic",
      model: overrides.model ?? "hf:zai-org/GLM-4.7-Flash",
      usage: {
        input,
        output,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: input + output,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: overrides.timestampMs - 1_000,
    },
  };
}

describe("cache-status", () => {
  it("marks Synthetic cache valid inside assumed window", () => {
    const status = getCacheFreshness(
      [assistantEntry({ timestampMs: 10_000 })],
      10_000 + SYNTHETIC_CACHE_TTL_MS - 1,
    );

    expect(status?.state).toBe("valid");
    expect(status?.ttlMs).toBe(SYNTHETIC_CACHE_TTL_MS);
  });

  it("marks Synthetic cache stale outside assumed window", () => {
    const status = getCacheFreshness(
      [assistantEntry({ timestampMs: 10_000 })],
      10_000 + SYNTHETIC_CACHE_TTL_MS + 1,
    );

    expect(status?.state).toBe("stale");
    expect(status?.ttlMs).toBe(SYNTHETIC_CACHE_TTL_MS);
  });

  it("keeps Synthetic on the assumed window even with long retention", () => {
    const status = getCacheFreshness(
      [assistantEntry({ timestampMs: 10_000 })],
      10_000 + SYNTHETIC_CACHE_TTL_MS + 1,
      "long",
    );

    expect(status?.state).toBe("stale");
    expect(status?.ttlMs).toBe(SYNTHETIC_CACHE_TTL_MS);
  });

  it("uses 5 minutes for Neuralwatt Kimi", () => {
    const status = getCacheFreshness(
      [
        assistantEntry({
          timestampMs: 10_000,
          provider: "neuralwatt",
          model: "kimi-k2.7-code",
        }),
      ],
      10_000 + NEURALWATT_KIMI_CACHE_TTL_MS + 1,
    );

    expect(status?.state).toBe("stale");
    expect(status?.ttlMs).toBe(NEURALWATT_KIMI_CACHE_TTL_MS);
  });

  it("uses 1 hour for Neuralwatt GLM", () => {
    const status = getCacheFreshness(
      [
        assistantEntry({
          timestampMs: 10_000,
          provider: "neuralwatt",
          model: "glm-5.2-short",
        }),
      ],
      10_000 + NEURALWATT_GLM_CACHE_TTL_MS - 1,
    );

    expect(status?.state).toBe("valid");
    expect(status?.ttlMs).toBe(NEURALWATT_GLM_CACHE_TTL_MS);
  });

  it("uses 5 minutes for default Anthropic cache", () => {
    const status = getCacheFreshness(
      [
        assistantEntry({
          timestampMs: 10_000,
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-sonnet-4-5",
        }),
      ],
      10_000 + ANTHROPIC_SHORT_CACHE_TTL_MS + 1,
    );

    expect(status?.state).toBe("stale");
    expect(status?.ttlMs).toBe(ANTHROPIC_SHORT_CACHE_TTL_MS);
  });

  it("uses short OpenAI heuristic for OpenAI Codex", () => {
    const status = getCacheFreshness(
      [
        assistantEntry({
          timestampMs: 10_000,
          api: "openai-codex-responses",
          provider: "openai-codex",
          model: "gpt-5.5",
        }),
      ],
      10_000 + OPENAI_SHORT_CACHE_TTL_MS - 1,
    );

    expect(status?.state).toBe("valid");
    expect(status?.ttlMs).toBe(OPENAI_SHORT_CACHE_TTL_MS);
  });

  it("uses 24 hours for long OpenAI-compatible retention", () => {
    const status = getCacheFreshness(
      [
        assistantEntry({
          timestampMs: 10_000,
          api: "openai-responses",
          provider: "openai",
          model: "gpt-5.2",
        }),
      ],
      10_000 + OPENAI_LONG_CACHE_TTL_MS - 1,
      "long",
    );

    expect(status?.state).toBe("valid");
    expect(status?.ttlMs).toBe(OPENAI_LONG_CACHE_TTL_MS);
  });

  it("returns unknown after compaction without a newer assistant message", () => {
    const status = getCacheFreshness([
      assistantEntry({ timestampMs: 10_000 }),
      compactionEntry(20_000),
    ]);

    expect(status).toEqual({ state: "unknown" });
  });

  it("returns undefined without a previous assistant message", () => {
    const userEntry: SessionEntry = {
      type: "message",
      id: "user-entry",
      parentId: null,
      timestamp: new Date(10_000).toISOString(),
      message: {
        role: "user",
        content: "hi",
        timestamp: 10_000,
      },
    };

    expect(getCacheFreshness([userEntry])).toBeUndefined();
  });
});
