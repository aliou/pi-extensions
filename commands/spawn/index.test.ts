import type { Message } from "@earendil-works/pi-ai";
import {
  type CustomMessageEntry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
  createPiTestHarness,
  type PiTestHarness,
} from "@harness/test-utils/pi-test-harness";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import setupSpawnCommand from "./index";
import {
  SESSION_LINK_SOURCE_TYPE,
  type SessionLinkSourceDetails,
} from "./types";

/**
 * Seed a real in-memory SessionManager with messages and return it.
 */
function seedParentSession(messages: Message[]): SessionManager {
  const sm = SessionManager.inMemory();
  for (const msg of messages) {
    sm.appendMessage(msg);
  }
  return sm;
}

/** Minimal assistant message with only the required fields filled in. */
function assistantMessage(texts: string[]): Message {
  return {
    role: "assistant",
    content: texts.map((t) => ({ type: "text" as const, text: t })),
    api: "messages",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

describe("breadcrumbs /spawn command", () => {
  let pi: PiTestHarness;

  beforeEach(async () => {
    pi = await createPiTestHarness(setupSpawnCommand);
  });

  it("registers the spawn command", () => {
    expect(pi).toHaveRegisteredCommand("spawn");
  });

  it("writes the last assistant message into the child source content", async () => {
    const parentSm = seedParentSession([
      {
        role: "user",
        content: "What should I work on?",
        timestamp: Date.now(),
      },
      assistantMessage(["First part", "Second part"]),
      {
        role: "user",
        content: "Ok spawn a session for that",
        timestamp: Date.now(),
      },
    ]);

    pi = await createPiTestHarness(setupSpawnCommand, {
      context: {
        sessionManager: parentSm,
        ui: { custom: vi.fn(async () => "last") as never },
      },
    });

    await pi.command("spawn").execute("");

    expect(pi.newSession).toHaveBeenCalledTimes(1);
    expect(pi.sendMessage).toHaveBeenCalledTimes(1);

    const calls = pi.sendMessage.mock.calls;
    expect(calls).toHaveLength(1);
    const [message, options] = calls[0] ?? [];
    expect(message?.customType).toBe(SESSION_LINK_SOURCE_TYPE);
    expect(message.display).toBe(true);
    expect(options).toEqual({ triggerTurn: true });

    const childSm = pi.getChildSessionManager();
    assert(childSm, "childSm should be defined");

    const entries = childSm.getEntries();
    const sourceEntry = entries.find(
      (e): e is CustomMessageEntry<SessionLinkSourceDetails> =>
        e.type === "custom_message" &&
        (e as CustomMessageEntry).customType === SESSION_LINK_SOURCE_TYPE,
    );

    assert(sourceEntry, "sourceEntry should be defined");
    expect(sourceEntry.display).toBe(true);

    const content =
      typeof sourceEntry.content === "string" ? sourceEntry.content : "";
    expect(content).toContain(
      `Session spawned from ${parentSm.getSessionId()}.`,
    );
    expect(content).toContain("## Last message in parent session");
    expect(content).toContain("First part\nSecond part");
    expect(content).not.toContain("read_session(");
    expect(content).not.toContain("Role: assistant");

    const details = sourceEntry.details as SessionLinkSourceDetails;
    expect(details.linkType).toBe("continue");
    expect(details.contextStrategy).toBe("last-assistant");
  });

  it("only identifies parent session in blank mode", async () => {
    const parentSm = seedParentSession([
      {
        role: "user",
        content: "What should I work on?",
        timestamp: Date.now(),
      },
      assistantMessage(["Parent context that should stay out"]),
    ]);

    pi = await createPiTestHarness(setupSpawnCommand, {
      context: {
        sessionManager: parentSm,
        ui: { custom: vi.fn(async () => "blank") as never },
      },
    });

    await pi.command("spawn").execute("");

    expect(pi.sendMessage).toHaveBeenCalledTimes(1);
    const calls = pi.sendMessage.mock.calls;
    expect(calls).toHaveLength(1);
    const [, options] = calls[0] ?? [];
    expect(options).toEqual({ triggerTurn: false });

    const childSm = pi.getChildSessionManager();
    assert(childSm, "childSm should be defined");

    const entries = childSm.getEntries();
    const sourceEntry = entries.find(
      (e): e is CustomMessageEntry =>
        e.type === "custom_message" &&
        (e as CustomMessageEntry).customType === SESSION_LINK_SOURCE_TYPE,
    );

    assert(sourceEntry, "sourceEntry should be defined");
    expect(sourceEntry.display).toBe(true);
    const content =
      typeof sourceEntry.content === "string" ? sourceEntry.content : "";
    expect(content).toBe(`Session spawned from ${parentSm.getSessionId()}.`);
    expect(content).not.toContain("read_session(");
    expect(content).not.toContain("Get more context");
    expect(content).not.toContain("Parent context that should stay out");

    const details = sourceEntry.details as SessionLinkSourceDetails;
    expect(details.contextStrategy).toBe("none");
  });

  it("omits the last-message section when there is no assistant message", async () => {
    const parentSm = seedParentSession([
      {
        role: "user",
        content: "Just a user message, no assistant reply",
        timestamp: Date.now(),
      },
    ]);

    pi = await createPiTestHarness(setupSpawnCommand, {
      context: {
        sessionManager: parentSm,
        ui: { custom: vi.fn(async () => "last") as never },
      },
    });

    await pi.command("spawn").execute("");

    const childSm = pi.getChildSessionManager();
    assert(childSm, "childSm should be defined");

    const entries = childSm.getEntries();
    const sourceEntry = entries.find(
      (e): e is CustomMessageEntry =>
        e.type === "custom_message" &&
        (e as CustomMessageEntry).customType === SESSION_LINK_SOURCE_TYPE,
    );

    assert(sourceEntry, "sourceEntry should be defined");
    const content =
      typeof sourceEntry.content === "string" ? sourceEntry.content : "";
    expect(content).not.toContain("## Last message in parent session");
  });

  it("notifies and aborts when there is no active parent leaf", async () => {
    const notify = vi.fn();

    pi = await createPiTestHarness(setupSpawnCommand, {
      context: {
        sessionManager: SessionManager.inMemory(),
        ui: { notify },
      },
    });

    await pi.command("spawn").execute("");

    expect(notify).toHaveBeenCalledWith(
      "Failed to get parent session leaf ID",
      "error",
    );
    expect(pi.newSession).not.toHaveBeenCalled();
  });
});
