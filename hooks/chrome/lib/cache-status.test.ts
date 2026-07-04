import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_SHORT_CACHE_TTL_MS,
  formatExpiredSince,
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
    // Pass an explicit short retention so the assertion is deterministic
    // regardless of an ambient PI_CACHE_RETENTION=long in the environment.
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
      "short",
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

describe("formatExpiredSince", () => {
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it("formats sub-minute ages as seconds", () => {
    expect(formatExpiredSince(0)).toBe("0s");
    expect(formatExpiredSince(45 * SECOND)).toBe("45s");
    expect(formatExpiredSince(59_499)).toBe("59s");
  });

  it("formats sub-hour ages as rounded minutes", () => {
    expect(formatExpiredSince(10 * MINUTE)).toBe("10m");
    expect(formatExpiredSince(59 * MINUTE + 29 * SECOND)).toBe("59m");
    expect(formatExpiredSince(59 * MINUTE + 30 * SECOND)).toBe("1h");
  });

  it("formats sub-day ages as rounded hours", () => {
    expect(formatExpiredSince(23 * HOUR)).toBe("23h");
    expect(formatExpiredSince(23 * HOUR + 29 * MINUTE)).toBe("23h");
    expect(formatExpiredSince(23 * HOUR + 30 * MINUTE)).toBe("1d");
  });

  it("shows days plus hours for multi-day ages", () => {
    expect(formatExpiredSince(DAY + 12 * HOUR)).toBe("1d12h");
    expect(formatExpiredSince(DAY + 22 * HOUR)).toBe("1d22h");
  });

  it("rolls the hour remainder up to the next whole day within an hour of it", () => {
    expect(formatExpiredSince(DAY + 23 * HOUR)).toBe("2d");
    expect(formatExpiredSince(DAY + 23 * HOUR + 30 * MINUTE)).toBe("2d");
    expect(formatExpiredSince(2 * DAY)).toBe("2d");
    expect(formatExpiredSince(2 * DAY + 12 * HOUR)).toBe("2d12h");
  });
});
