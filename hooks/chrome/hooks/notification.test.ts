import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
} from "@harness/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupNotificationHook } from "./notification";

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

function createPi() {
  const handlers = new Map<string, Handler[]>();
  const eventHandlers = new Map<string, Array<(data: unknown) => void>>();
  const emitted: Array<{ event: string; data: unknown }> = [];
  const exec = vi.fn(async () => ({
    stdout: "",
    stderr: "",
    code: 0,
    killed: false,
  }));
  const events = {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      eventHandlers.set(event, [...(eventHandlers.get(event) ?? []), handler]);
      return () => {};
    }),
    emit: vi.fn((event: string, data: unknown) => {
      emitted.push({ event, data });
      for (const handler of eventHandlers.get(event) ?? []) handler(data);
    }),
  };
  const pi = {
    exec,
    events,
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
  } as unknown as ExtensionAPI;

  return { pi, exec, events, emitted, handlers };
}

describe("Chrome notifications in Herdr", () => {
  const previousHerdrEnv = process.env.HERDR_ENV;
  const isTtyDescriptor = Object.getOwnPropertyDescriptor(
    process.stdout,
    "isTTY",
  );

  beforeEach(() => {
    process.env.HERDR_ENV = "1";
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousHerdrEnv === undefined) delete process.env.HERDR_ENV;
    else process.env.HERDR_ENV = previousHerdrEnv;
    if (isTtyDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", isTtyDescriptor);
    } else {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
  });

  it("delegates AD notifications while retaining ask_user and done emission", async () => {
    const { pi, exec, events, emitted, handlers } = createPi();
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const ctx = {} as ExtensionContext;
    setupNotificationHook(pi);

    events.emit(AD_NOTIFY_ATTENTION_EVENT, { description: "attention" });
    events.emit(AD_NOTIFY_DANGEROUS_EVENT, { description: "dangerous" });
    events.emit(AD_NOTIFY_DONE_EVENT, { summary: "done", status: "ok" });
    expect(write).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();

    await handlers.get("tool_call")?.[0]?.(
      { toolName: "ask_user", toolCallId: "tool-1" },
      ctx,
    );
    expect(
      emitted.some(
        (item) =>
          item.event === AD_NOTIFY_ATTENTION_EVENT &&
          (item.data as { toolCallId?: string }).toolCallId === "tool-1",
      ),
    ).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();

    write.mockClear();
    exec.mockClear();
    await handlers.get("turn_end")?.[0]?.({ toolResults: [] }, ctx);
    await handlers.get("agent_end")?.[0]?.(
      { messages: [{ role: "assistant", stopReason: "stop" }] },
      ctx,
    );

    expect(emitted.some((item) => item.event === AD_NOTIFY_DONE_EVENT)).toBe(
      true,
    );
    expect(write).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("delivers ask_user attention through Chrome outside Herdr", async () => {
    delete process.env.HERDR_ENV;
    const { pi, handlers } = createPi();
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    setupNotificationHook(pi);

    await handlers.get("tool_call")?.[0]?.(
      { toolName: "ask_user", toolCallId: "tool-1" },
      {} as ExtensionContext,
    );

    expect(write).toHaveBeenCalled();
  });
});
