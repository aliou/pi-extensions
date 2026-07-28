import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
} from "@harness/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import herdr, { _resetForTesting } from "./index";

const HERDR_BLOCKED_EVENT = "herdr:blocked";

type LifecycleHandler = (event?: { toolCallId?: string }) => void;

interface MockPi {
  pi: ExtensionAPI;
  fire: (event: string, payload?: { toolCallId?: string }) => void;
  emit: ReturnType<typeof vi.spyOn>;
}

function createMockPi(): MockPi {
  const lifecycle: Record<string, LifecycleHandler[]> = {};
  const pi = {
    events: createEventBus(),
    on: vi.fn((event: string, handler: LifecycleHandler) => {
      const handlers = lifecycle[event] ?? [];
      handlers.push(handler);
      lifecycle[event] = handlers;
    }),
  } as unknown as ExtensionAPI;
  const fire = (event: string, payload?: { toolCallId?: string }): void => {
    for (const handler of lifecycle[event] ?? []) handler(payload);
  };
  return { pi, fire, emit: vi.spyOn(pi.events, "emit") };
}

function blockedEvents(mock: MockPi): { active: boolean; label?: string }[] {
  return mock.emit.mock.calls
    .filter(([event]: unknown[]) => event === HERDR_BLOCKED_EVENT)
    .map(
      ([, payload]: unknown[]) =>
        payload as { active: boolean; label?: string },
    );
}

describe("herdr hook", () => {
  beforeEach(() => _resetForTesting());

  it("ignores Guardrails compatibility danger notifications", () => {
    const mock = createMockPi();
    herdr(mock.pi);

    mock.pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
      source: "defaults:event-compat:guardrails",
      description: "recursive force delete",
    });

    expect(mock.emit).not.toHaveBeenCalledWith(
      HERDR_BLOCKED_EVENT,
      expect.anything(),
    );
  });

  it("blocks on other dangerous notifications", () => {
    const mock = createMockPi();
    herdr(mock.pi);

    mock.pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
      description: "Dangerous action detected",
      toolCallId: "tool-call-1",
    });

    expect(mock.emit).toHaveBeenCalledWith(HERDR_BLOCKED_EVENT, {
      active: true,
      label: "Dangerous action detected",
    });
  });

  describe("error block lifecycle", () => {
    it("blocks on an error done event", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });

      expect(blockedEvents(mock)).toEqual([
        { active: true, label: "An error occurred" },
      ]);
    });

    it("stays blocked across a retry agent_start", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      // Fresh user turn starts the run.
      mock.fire("agent_start");
      // Error during the run.
      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      mock.emit.mockClear();

      // Retry fires a new agent_start inside the same run (no settle yet).
      mock.fire("agent_start");

      expect(blockedEvents(mock)).toEqual([]);
    });

    it("stays blocked on agent_settled after a final failed retry", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      mock.fire("agent_start");
      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      // Retry attempt also fails.
      mock.fire("agent_start");
      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      mock.emit.mockClear();

      // Run settles with the error unresolved.
      mock.fire("agent_settled");

      expect(blockedEvents(mock)).toEqual([]);
    });

    it("unblocks when a retry recovers (done ok)", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      mock.fire("agent_start");
      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      // Retry succeeds.
      mock.fire("agent_start");
      mock.emit.mockClear();

      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "ok" });

      expect(blockedEvents(mock)).toEqual([{ active: false }]);
    });

    it("unblocks on the next fresh user turn after a settled error", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      mock.fire("agent_start");
      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      mock.fire("agent_settled");
      mock.emit.mockClear();

      // Next user turn: fresh agent_start after a settle.
      mock.fire("agent_start");

      expect(blockedEvents(mock)).toEqual([{ active: false }]);
    });

    it("unblocks all on session_shutdown", () => {
      const mock = createMockPi();
      herdr(mock.pi);

      mock.pi.events.emit(AD_NOTIFY_DONE_EVENT, { status: "error" });
      mock.emit.mockClear();

      mock.fire("session_shutdown");

      expect(blockedEvents(mock)).toEqual([{ active: false }]);
    });
  });
});
