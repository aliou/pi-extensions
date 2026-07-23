import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
} from "@harness/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupHerdrHook } from "./index";
import type { HerdrClient, HerdrNotification } from "./lib/client";

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

function createPi(): {
  pi: ExtensionAPI;
  emitLifecycle: (event: string, data: unknown, ctx: ExtensionContext) => void;
} {
  const lifecycleHandlers = new Map<string, Handler[]>();
  const eventHandlers = new Map<string, Array<(data: unknown) => void>>();
  const events = {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      eventHandlers.set(event, [...(eventHandlers.get(event) ?? []), handler]);
      return () => {};
    }),
    emit: vi.fn((event: string, data: unknown) => {
      for (const handler of eventHandlers.get(event) ?? []) handler(data);
    }),
  };
  const pi = {
    on: vi.fn((event: string, handler: Handler) => {
      lifecycleHandlers.set(event, [
        ...(lifecycleHandlers.get(event) ?? []),
        handler,
      ]);
    }),
    events,
  } as unknown as ExtensionAPI;

  return {
    pi,
    emitLifecycle: (event, data, ctx) => {
      for (const handler of lifecycleHandlers.get(event) ?? []) {
        handler(data, ctx);
      }
    },
  };
}

function createClient(): {
  client: HerdrClient;
  metadata: Array<{
    tokens: Record<string, string | null>;
    ttlMs?: number;
  }>;
  notifications: HerdrNotification[];
  close: ReturnType<typeof vi.fn>;
} {
  const metadata: Array<{
    tokens: Record<string, string | null>;
    ttlMs?: number;
  }> = [];
  const notifications: HerdrNotification[] = [];
  const close = vi.fn();
  return {
    metadata,
    notifications,
    close,
    client: {
      reportMetadata: (tokens, ttlMs) => metadata.push({ tokens, ttlMs }),
      showNotification: (notification) => notifications.push(notification),
      close,
    },
  };
}

function createContext(nowMs: number): ExtensionContext {
  const assistantEntry = {
    type: "message",
    timestamp: new Date(nowMs - 60_000).toISOString(),
    message: {
      role: "assistant",
      api: "openai-codex-responses",
      provider: "openai-codex",
      model: "gpt-5.6",
      timestamp: nowMs - 60_000,
    },
  };
  return {
    hasUI: true,
    model: { provider: "openai-codex", id: "gpt-5.6" },
    sessionManager: { getBranch: () => [assistantEntry] },
  } as unknown as ExtensionContext;
}

describe("Herdr hook", () => {
  const previousHerdrEnv = process.env.HERDR_ENV;

  beforeEach(() => {
    process.env.HERDR_ENV = "1";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousHerdrEnv === undefined) delete process.env.HERDR_ENV;
    else process.env.HERDR_ENV = previousHerdrEnv;
  });

  it("publishes cache metadata, refreshes it, and stops on shutdown", async () => {
    const { pi, emitLifecycle } = createPi();
    const { client, close, metadata } = createClient();
    const ctx = createContext(Date.now());
    setupHerdrHook(pi, client);

    emitLifecycle("session_start", { reason: "startup" }, ctx);
    expect(metadata[metadata.length - 1]).toEqual({
      tokens: { ad_cache: "≡ 9m" },
      ttlMs: 540_000,
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(metadata[metadata.length - 1]).toEqual({
      tokens: { ad_cache: "≡ 8m" },
      ttlMs: 480_000,
    });

    const nonUiContext = { ...ctx, hasUI: false } as ExtensionContext;
    const metadataCount = metadata.length;
    emitLifecycle("model_select", {}, nonUiContext);
    emitLifecycle("session_shutdown", { reason: "quit" }, nonUiContext);
    expect(metadata).toHaveLength(metadataCount);
    expect(close).not.toHaveBeenCalled();

    emitLifecycle("session_shutdown", { reason: "quit" }, ctx);
    const count = metadata.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(metadata).toHaveLength(count);
    expect(close).toHaveBeenCalledOnce();
  });

  it("maps attention events to Herdr request notifications", () => {
    const { pi, emitLifecycle } = createPi();
    const { client, notifications } = createClient();
    setupHerdrHook(pi, client);
    emitLifecycle(
      "session_start",
      { reason: "startup" },
      createContext(Date.now()),
    );

    pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
      description: "Approval required",
    });

    expect(notifications[notifications.length - 1]).toEqual({
      title: "Pi needs attention",
      body: "Approval required",
      sound: "request",
    });

    pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
      description: "rm -rf requested",
    });
    expect(notifications[notifications.length - 1]).toEqual({
      title: "Pi needs attention",
      body: "Dangerous command detected: rm -rf requested",
      sound: "request",
    });
  });
});
