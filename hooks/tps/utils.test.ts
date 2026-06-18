import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import type { TurnTiming } from "./types";
import { buildTelemetry } from "./utils";

/** Minimal assistant message with overridable usage/provider/model. */
function msg(
  overrides: {
    output?: number;
    input?: number;
    provider?: string;
    model?: string;
  } = {},
): AssistantMessage {
  const {
    output = 20,
    input = 10,
    provider = "openai",
    model = "gpt-4",
  } = overrides;
  return {
    role: "assistant",
    content: [{ type: "text", text: "Hi" }],
    api: "openai-completions",
    provider,
    model,
    usage: {
      input,
      output,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: input + output,
      cost: {
        input: 0.001,
        output: 0.002,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0.003,
      },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

/** Build a TurnTiming with streaming spans derived from update timestamps. */
function timing(overrides: {
  turnStartMs?: number;
  firstTokenMs?: number | null;
  firstStreamUpdateMs?: number | null;
  lastStreamUpdateMs?: number;
  updateCount?: number;
  stallMs?: number;
  stallCount?: number;
  totalGenerationMs?: number;
  messageCount?: number;
  messages?: AssistantMessage[];
}): TurnTiming {
  return {
    turnStartMs: overrides.turnStartMs ?? 0,
    lastUpdateMs: 0,
    firstTokenMs:
      overrides.firstTokenMs === undefined ? 100 : overrides.firstTokenMs,
    currentMessageStartMs: null,
    assistantMessages: overrides.messages ?? [msg()],
    totalGenerationMs: overrides.totalGenerationMs ?? 800,
    updateCount: overrides.updateCount ?? 5,
    firstStreamUpdateMs: overrides.firstStreamUpdateMs ?? 200,
    lastStreamUpdateMs: overrides.lastStreamUpdateMs ?? 600,
    stallMs: overrides.stallMs ?? 0,
    stallCount: overrides.stallCount ?? 0,
    inStall: false,
    messageCount: overrides.messageCount ?? 1,
    isToolCall: false,
    isPrimaryBranch: false,
  };
}

describe("buildTelemetry — null cases", () => {
  it("returns null when output is zero", () => {
    const t = buildTelemetry(timing({ messages: [msg({ output: 0 })] }), 1000);
    expect(t).toBeNull();
  });

  it("returns null when firstTokenMs is null (no tokens streamed)", () => {
    const t = buildTelemetry(timing({ firstTokenMs: null }), 1000);
    expect(t).toBeNull();
  });

  it("returns null when no model is present on the message", () => {
    const t = buildTelemetry(
      timing({ messages: [msg({ provider: "", model: "" })] }),
      1000,
    );
    expect(t).toBeNull();
  });
});

describe("buildTelemetry — primary branch (reliable streaming)", () => {
  it("computes TPS from effective stream window (no stalls)", () => {
    // 20 tokens, streamMs = 600 - 200 = 400ms → 50 tok/s
    const t = buildTelemetry(timing({}), 1000);
    expect(t).not.toBeNull();
    expect(t?.tps).toBe(50);
    expect(t?.isPrimaryBranch).toBe(true);
    expect(t?.timing.streamMs).toBe(400);
    expect(t?.timing.stallMs).toBe(0);
  });

  it("subtracts stall time from the streaming window", () => {
    // streamMs = 400, stallMs = 100 → effectiveStreamMs = 300 → 66.7 tok/s
    const t = buildTelemetry(timing({ stallMs: 100, stallCount: 1 }), 1000);
    expect(t).not.toBeNull();
    expect(t?.isPrimaryBranch).toBe(true);
    // 20 / 0.3 = 66.66 → 66.7
    expect(t?.tps).toBe(66.7);
  });

  it("falls back when stallMs >= effectiveStreamMs (stall dominates stream)", () => {
    // streamMs = 400, stallMs = 300 → effectiveStreamMs = 100 < 200ms floor,
    // and stallMs(300) < effectiveStreamMs(100)? No → primary skipped.
    // Fallback: generationMs(800) >= 200 → effectiveGenMs = 800 - 300 = 500
    // → 20 / 0.5 = 40 tok/s
    const t = buildTelemetry(
      timing({ stallMs: 300, stallCount: 1, totalGenerationMs: 800 }),
      1000,
    );
    expect(t).not.toBeNull();
    expect(t?.isPrimaryBranch).toBe(false);
    expect(t?.tps).toBe(40);
  });

  it("requires ≥5 updates for primary branch", () => {
    // 4 updates → primary skipped. generationMs(800) >= 200 → fallback.
    // effectiveGenMs = 800 → 20/0.8 = 25 tok/s
    const t = buildTelemetry(timing({ updateCount: 4 }), 1000);
    expect(t).not.toBeNull();
    expect(t?.isPrimaryBranch).toBe(false);
    expect(t?.tps).toBe(25);
  });

  it("requires avg inter-chunk gap ≥1ms (buffer-flush signature → null/fallback)", () => {
    // 5 updates over 1ms → avg gap 0.25ms < 1ms → primary skipped.
    // generationMs(1.5ms) < 200 → fallback fails too → null.
    const t = buildTelemetry(
      timing({
        updateCount: 5,
        firstStreamUpdateMs: 100.2,
        lastStreamUpdateMs: 101,
        totalGenerationMs: 1.5,
      }),
      200,
    );
    expect(t).not.toBeNull();
    expect(t?.tps).toBeNull();
  });

  it("requires effective stream span ≥200ms", () => {
    // streamMs = 50 < 200 → primary skipped. generationMs(60) < 200 → null.
    const t = buildTelemetry(
      timing({
        updateCount: 5,
        firstStreamUpdateMs: 100,
        lastStreamUpdateMs: 150,
        totalGenerationMs: 60,
      }),
      200,
    );
    expect(t).not.toBeNull();
    expect(t?.tps).toBeNull();
  });
});

describe("buildTelemetry — fallback branch", () => {
  it("uses generationMs when primary gate fails (few updates, long gen)", () => {
    // 2 updates, generationMs = 250 → effectiveGenMs = 250 → 80 tok/s
    const t = buildTelemetry(
      timing({
        updateCount: 2,
        firstStreamUpdateMs: 100,
        lastStreamUpdateMs: 100.2,
        totalGenerationMs: 250,
      }),
      300,
    );
    expect(t).not.toBeNull();
    expect(t?.isPrimaryBranch).toBe(false);
    expect(t?.tps).toBe(80);
  });

  it("returns null when both primary and fallback fail (few updates, short gen)", () => {
    const t = buildTelemetry(
      timing({
        updateCount: 2,
        firstStreamUpdateMs: 10,
        lastStreamUpdateMs: 10.2,
        totalGenerationMs: 5,
      }),
      20,
    );
    expect(t).not.toBeNull();
    expect(t?.tps).toBeNull();
  });
});

describe("buildTelemetry — volume gate (MAX_PLAUSIBLE_TPS)", () => {
  it("nulls TPS above 10000 tok/s as a measurement artifact", () => {
    // 2100 tokens over 100ms effective window → 10500 tok/s > 10000 → null.
    // Primary skipped (streamMs 100 < 200ms floor); fallback fires
    // (generationMs 200 >= 200) → 2100/0.2 = 10500 > 10000 → null.
    const t = buildTelemetry(
      timing({
        messages: [msg({ output: 2100 })],
        updateCount: 5,
        firstStreamUpdateMs: 100,
        lastStreamUpdateMs: 200,
        totalGenerationMs: 200,
      }),
      300,
    );
    expect(t).not.toBeNull();
    expect(t?.tps).toBeNull();
    expect(t?.isPrimaryBranch).toBe(false);
  });
});

describe("buildTelemetry — tokens, cost, timing fields", () => {
  it("sums tokens and cost across multiple messages", () => {
    const t = buildTelemetry(
      timing({
        messages: [
          msg({ output: 20, input: 10 }),
          msg({ output: 30, input: 5 }),
        ],
        messageCount: 2,
        totalGenerationMs: 800,
      }),
      1000,
    );
    expect(t).not.toBeNull();
    expect(t?.tokens.input).toBe(15);
    expect(t?.tokens.output).toBe(50);
    expect(t?.tokens.total).toBe(65);
    expect(t?.timing.messageCount).toBe(2);
    expect(t?.cost).not.toBeNull();
    expect(t?.cost?.total).toBeCloseTo(0.006, 3);
  });

  it("reports null cost when messages have no cost field", () => {
    const noCost = msg() as unknown as AssistantMessage;
    delete (noCost.usage as { cost?: unknown }).cost;
    const t = buildTelemetry(timing({ messages: [noCost] }), 1000);
    expect(t).not.toBeNull();
    expect(t?.cost).toBeNull();
  });

  it("records ttftMs and totalMs from timing", () => {
    const t = buildTelemetry(
      timing({ turnStartMs: 0, firstTokenMs: 150 }),
      1000,
    );
    expect(t).not.toBeNull();
    expect(t?.timing.ttftMs).toBe(150);
    expect(t?.timing.totalMs).toBe(1000);
  });

  it("captures the model provider/modelId from the first message that has one", () => {
    const t = buildTelemetry(
      timing({ messages: [msg({ provider: "anthropic", model: "claude-4" })] }),
      1000,
    );
    expect(t).not.toBeNull();
    expect(t?.model).toEqual({
      provider: "anthropic",
      modelId: "claude-4",
    });
  });
});
