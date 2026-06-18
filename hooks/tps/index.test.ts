import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AD_TPS_TELEMETRY_EVENT, type TpsTelemetry } from "@harness/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tpsHook from "./index";

// ---------------------------------------------------------------------------
// Mock ExtensionAPI — captures event handlers and emitted events.
// Pattern mirrors hooks/protect-sessions-dir/index.test.ts.
// ---------------------------------------------------------------------------

interface MockFixture {
  pi: ExtensionAPI;
  handlers: Map<string, Array<(event: unknown) => unknown>>;
  emitted: TpsTelemetry[];
}

function createMockPi(): MockFixture {
  const handlers = new Map<string, Array<(event: unknown) => unknown>>();
  const emitted: TpsTelemetry[] = [];

  const onFn = vi.fn(
    (event: string, handler: (...args: unknown[]) => unknown) => {
      const list = handlers.get(event) ?? [];
      list.push(handler as (event: unknown) => unknown);
      handlers.set(event, list);
    },
  );

  const events = {
    emit: vi.fn((name: string, data: TpsTelemetry) => {
      if (name === AD_TPS_TELEMETRY_EVENT) emitted.push(data);
    }),
    on: vi.fn(),
  };

  const pi = {
    on: onFn,
    events: events as unknown as ExtensionAPI["events"],
  } as unknown as ExtensionAPI;

  return { pi, handlers, emitted };
}

function emit(fixture: MockFixture, event: string, payload: unknown): void {
  for (const handler of fixture.handlers.get(event) ?? []) {
    handler(payload);
  }
}

// ---------------------------------------------------------------------------
// Turn driver — mocks performance.now() with an explicit timestamp sequence.
// ---------------------------------------------------------------------------

interface TurnClocks {
  turnStart: number;
  messageStart: number;
  firstUpdate: number;
  streamUpdates: number[];
  messageEnd: number;
  turnEnd?: number;
  isToolCall?: boolean;
  message?: AssistantMessage;
}

function makeMessage(
  overrides: {
    output?: number;
    input?: number;
    provider?: string;
    model?: string;
    stopReason?: string;
  } = {},
): AssistantMessage {
  const {
    output = 20,
    input = 50,
    provider = "openai",
    model = "gpt-4",
    stopReason = "stop",
  } = overrides;
  return {
    role: "assistant",
    content: [{ type: "text", text: "Response" }],
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
    stopReason: stopReason as AssistantMessage["stopReason"],
    timestamp: Date.now(),
  };
}

function driveTurn(
  fixture: MockFixture,
  clocks: TurnClocks,
): TpsTelemetry | null {
  const before = fixture.emitted.length;

  // performance.now() call order (one call per handler entry point,
  // since index.ts reuses a single `const now` per handler):
  // turn_start, message_start, first message_update (TTFT),
  // each stream update, message_end, turn_end.
  const timestamps = [
    clocks.turnStart,
    clocks.messageStart,
    clocks.firstUpdate,
    ...clocks.streamUpdates,
    clocks.messageEnd,
    clocks.turnEnd ?? clocks.messageEnd,
  ];
  let callIdx = 0;
  const spy = vi
    .spyOn(performance, "now")
    .mockImplementation(
      () => timestamps[Math.min(callIdx++, timestamps.length - 1)] ?? 0,
    );

  const message =
    clocks.message ??
    makeMessage({ stopReason: clocks.isToolCall ? "toolUse" : "stop" });

  emit(fixture, "turn_start", {
    type: "turn_start",
    turnIndex: 0,
    timestamp: Date.now(),
  });
  emit(fixture, "message_start", { type: "message_start", message });
  // TTFT update
  emit(fixture, "message_update", { type: "message_update", message });
  // Streaming updates
  for (const _ts of clocks.streamUpdates) {
    emit(fixture, "message_update", { type: "message_update", message });
  }
  if (clocks.isToolCall) {
    emit(fixture, "tool_execution_start", {
      type: "tool_execution_start",
      toolCallId: "call_1",
      toolName: "bash",
      args: {},
    });
  }
  emit(fixture, "message_end", { type: "message_end", message });
  emit(fixture, "turn_end", {
    type: "turn_end",
    turnIndex: 0,
    message,
    toolResults: [],
  });

  spy.mockRestore();

  const newEvents = fixture.emitted.slice(before);
  return newEvents.length > 0
    ? (newEvents[newEvents.length - 1] ?? null)
    : null;
}

// A reliable ~50 TPS streaming turn: 20 tokens / 0.4s.
const RELIABLE_50_TPS: TurnClocks = {
  turnStart: 0,
  messageStart: 200,
  firstUpdate: 200.123,
  streamUpdates: [400, 500, 600, 700, 800],
  messageEnd: 900,
};

// A fallback tool-call turn: 2 updates, 250ms generation → 80 tok/s uncapped.
const TOOL_CALL_FALLBACK: TurnClocks = {
  turnStart: 0,
  messageStart: 100,
  firstUpdate: 100.1,
  streamUpdates: [100.15, 100.3],
  messageEnd: 350,
  isToolCall: true,
};

describe("tps hook — dynamic TPS cap", () => {
  let fixture: MockFixture;

  beforeEach(() => {
    fixture = createMockPi();
    tpsHook(fixture.pi);
  });

  it("emits ad:tps:telemetry with reliable TPS from a primary-branch turn", () => {
    const t = driveTurn(fixture, RELIABLE_50_TPS);
    expect(t).not.toBeNull();
    expect(t?.tps).toBeGreaterThanOrEqual(40);
    expect(t?.tps).toBeLessThanOrEqual(60);
    expect(t?.isPrimaryBranch).toBe(true);
  });

  it("clamps tool-call TPS to the cap set by a prior streaming turn", () => {
    // Turn 1: sets cap at ~50 TPS.
    driveTurn(fixture, RELIABLE_50_TPS);
    // Turn 2: fallback tool call (uncapped would be ~80) → clamped to ~50.
    const t = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t).not.toBeNull();
    expect(t?.tps).not.toBeNull();
    expect(t?.tps).toBeLessThanOrEqual(55);
    expect(t?.tps).toBeGreaterThan(0);
  });

  it("nulls tool-call TPS when no cap exists yet (cold start)", () => {
    const t = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t).not.toBeNull();
    expect(t?.tps).toBeNull();
  });

  it("does not let fallback-branch tool-call turns set the cap", () => {
    // Turn 1: fallback tool call — must NOT set the cap.
    const t1 = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t1?.tps).toBeNull();

    // Turn 2: reliable streaming → sets cap at ~50.
    const t2 = driveTurn(fixture, RELIABLE_50_TPS);
    expect(t2?.tps).toBeGreaterThanOrEqual(40);

    // Turn 3: fallback tool call — now clamped to ~50 (not null).
    const t3 = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t3?.tps).not.toBeNull();
    expect(t3?.tps).toBeLessThanOrEqual(55);
  });

  it("lets primary-branch tool-call turns set the cap (reasoning + tool call)", () => {
    // Turn 1: primary-branch tool call → sets cap at ~50.
    const t1 = driveTurn(fixture, { ...RELIABLE_50_TPS, isToolCall: true });
    expect(t1?.tps).toBeGreaterThanOrEqual(40);
    expect(t1?.tps).toBeLessThanOrEqual(60);
    expect(t1?.isPrimaryBranch).toBe(true);

    // Turn 2: fallback tool call — clamped to the cap from turn 1.
    const t2 = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t2?.tps).not.toBeNull();
    expect(t2?.tps).toBeLessThanOrEqual(55);
  });

  it("does not clamp non-tool-call fallback turns", () => {
    driveTurn(fixture, RELIABLE_50_TPS);
    // Non-tool-call fallback: uncapped even though it exceeds the cap.
    const t = driveTurn(fixture, { ...TOOL_CALL_FALLBACK, isToolCall: false });
    expect(t?.tps).not.toBeNull();
    expect(t?.tps).toBeGreaterThan(50);
  });

  it("only raises the cap, never lowers it", () => {
    // Turn 1: cap at ~50.
    driveTurn(fixture, RELIABLE_50_TPS);
    // Turn 2: slower streaming (~25 tok/s) — must not lower the cap.
    driveTurn(fixture, {
      turnStart: 0,
      messageStart: 200,
      firstUpdate: 200.123,
      streamUpdates: [600, 800, 1000, 1200, 1400],
      messageEnd: 1500,
    });
    // Turn 3: tool call → clamped to 50 (the higher cap), not 25.
    const t = driveTurn(fixture, TOOL_CALL_FALLBACK);
    expect(t?.tps).not.toBeNull();
    expect(t?.tps).toBeLessThanOrEqual(55);
  });

  it("maintains separate caps per model", () => {
    // Turn 1: openai/gpt-4 sets cap at ~50.
    driveTurn(fixture, RELIABLE_50_TPS);
    // Turn 2: deepseek tool call — no cap for deepseek yet → null.
    const t = driveTurn(fixture, {
      ...TOOL_CALL_FALLBACK,
      message: makeMessage({
        provider: "deepseek",
        model: "deepseek-v3",
        stopReason: "toolUse",
      }),
    });
    expect(t?.tps).toBeNull();
  });
});

describe("tps hook — no telemetry emitted for non-assistant turns", () => {
  let fixture: MockFixture;

  beforeEach(() => {
    fixture = createMockPi();
    tpsHook(fixture.pi);
  });

  it("does not emit when the assistant message has no output", () => {
    const before = fixture.emitted.length;
    driveTurn(fixture, {
      ...RELIABLE_50_TPS,
      message: makeMessage({ output: 0 }),
    });
    expect(fixture.emitted.length).toBe(before);
  });
});
