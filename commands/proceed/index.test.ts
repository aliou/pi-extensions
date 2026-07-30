import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  AD_HEADER_REGISTER_SHORTCUT_EVENT,
} from "@harness/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import setupProceedCommand, {
  PROCEED_DESCRIPTION,
  PROCEED_SHORTCUT,
} from "./index";

function createMockPi() {
  return {
    on: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    sendMessage: vi.fn(),
    events: createEventBus(),
  } as unknown as ExtensionAPI & {
    on: ReturnType<typeof vi.fn>;
    registerCommand: ReturnType<typeof vi.fn>;
    registerShortcut: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
}

function getShortcutHandler(pi: ReturnType<typeof createMockPi>) {
  const call = pi.registerShortcut.mock.calls.find(
    ([key]) => key === PROCEED_SHORTCUT,
  );
  if (!call) throw new Error("shortcut not registered");
  return call[1].handler as (ctx: {
    ui: {
      notify: ReturnType<typeof vi.fn>;
      getEditorText: () => string;
      setEditorText: ReturnType<typeof vi.fn>;
    };
  }) => Promise<void>;
}

function getContextHandler(pi: ReturnType<typeof createMockPi>) {
  const call = pi.on.mock.calls.find(([event]) => event === "context");
  if (!call) throw new Error("context handler not registered");
  return call[1] as (event: {
    messages: unknown[];
  }) => { messages?: unknown[] } | undefined;
}

function getCommandHandler(pi: ReturnType<typeof createMockPi>) {
  const call = pi.registerCommand.mock.calls[0];
  if (!call) throw new Error("command not registered");
  return call[1].handler as (
    args: string,
    ctx: {
      ui: { notify: ReturnType<typeof vi.fn> };
      isIdle: () => boolean;
      sessionManager: { getEntries: () => unknown[] };
    },
  ) => Promise<void>;
}

describe("/proceed command", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
    setupProceedCommand(pi);
  });

  it("registers the /proceed command", () => {
    expect(pi.registerCommand).toHaveBeenCalledTimes(1);
    expect(pi.registerCommand).toHaveBeenCalledWith(
      "proceed",
      expect.objectContaining({
        description: PROCEED_DESCRIPTION,
      }),
    );
  });

  it("registers itself in the header", () => {
    const emitSpy = vi.spyOn(pi.events, "emit");
    pi.events.emit(AD_HEADER_COLLECT_EVENT, undefined);

    expect(emitSpy).toHaveBeenCalledWith(
      AD_HEADER_REGISTER_COMMAND_EVENT,
      expect.objectContaining({
        name: "proceed",
        description: expect.any(String),
      }),
    );
  });

  it("registers its shortcut in the header", () => {
    const emitSpy = vi.spyOn(pi.events, "emit");
    pi.events.emit(AD_HEADER_COLLECT_EVENT, undefined);

    expect(emitSpy).toHaveBeenCalledWith(
      AD_HEADER_REGISTER_SHORTCUT_EVENT,
      expect.objectContaining({
        key: PROCEED_SHORTCUT,
        description: expect.any(String),
      }),
    );
  });

  it("fills an empty editor with /proceed", async () => {
    const handler = getShortcutHandler(pi);
    const setEditorText = vi.fn();
    const notify = vi.fn();

    await handler({
      ui: { notify, getEditorText: () => "", setEditorText },
    });

    expect(setEditorText).toHaveBeenCalledWith("/proceed");
    expect(notify).not.toHaveBeenCalled();
  });

  it("warns instead of overwriting a non-empty editor", async () => {
    const handler = getShortcutHandler(pi);
    const setEditorText = vi.fn();
    const notify = vi.fn();

    await handler({
      ui: { notify, getEditorText: () => "draft", setEditorText },
    });

    expect(setEditorText).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("stash"),
      "warning",
    );
  });

  it("sends a hidden custom message that triggers a follow-up turn", async () => {
    const handler = getCommandHandler(pi);
    const ctx = {
      ui: { notify: vi.fn() },
      isIdle: () => true,
      sessionManager: { getEntries: () => [] },
    };

    await handler("", ctx);

    expect(pi.sendMessage).toHaveBeenCalledTimes(1);
    expect(pi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "harness:proceed",
        content: [],
        display: false,
      }),
      expect.objectContaining({
        triggerTurn: true,
        deliverAs: "followUp",
      }),
    );
  });

  it("filters its marker from context messages before provider serialization", () => {
    const handler = getContextHandler(pi);
    const marker = { role: "custom", customType: "harness:proceed" };
    const user = { role: "user", content: "hello" };

    const result = handler({ messages: [user, marker] });

    expect(result).toEqual({ messages: [user] });
  });

  it("returns undefined from context handler when there is no marker", () => {
    const handler = getContextHandler(pi);
    const user = { role: "user", content: "hello" };

    const result = handler({ messages: [user] });

    expect(result).toBeUndefined();
  });

  it("shows status with idle state and last assistant text", async () => {
    const handler = getCommandHandler(pi);
    const notify = vi.fn();
    const ctx = {
      ui: { notify },
      isIdle: () => false,
      sessionManager: {
        getEntries: () => [
          { type: "message", message: { role: "user", content: "hi" } },
          {
            type: "message",
            message: { role: "assistant", content: "working" },
          },
        ],
      },
    };

    await handler("status", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Agent idle: no"),
      "info",
    );
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Last assistant: working"),
      "info",
    );
  });

  it("shows help text", async () => {
    const handler = getCommandHandler(pi);
    const notify = vi.fn();
    const ctx = {
      ui: { notify },
      isIdle: () => true,
      sessionManager: { getEntries: () => [] },
    };

    await handler("help", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("/proceed"),
      "info",
    );
  });
});
