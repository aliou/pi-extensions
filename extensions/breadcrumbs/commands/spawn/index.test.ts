import type { Message } from "@mariozechner/pi-ai";
import {
  type CustomMessageEntry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPiTestHarness,
  type PiTestHarness,
} from "../../../../tests/utils/pi-test-harness";
import {
  SESSION_LINK_SOURCE_TYPE,
  type SessionLinkSourceDetails,
} from "../../lib/session-link";
import setupSpawnCommand from "./index";

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

    const setEditorText = vi.fn();

    pi = await createPiTestHarness(setupSpawnCommand, {
      context: {
        sessionManager: parentSm,
        ui: { setEditorText },
      },
    });

    await pi.command("spawn").execute("focus on tests");

    expect(pi.newSession).toHaveBeenCalledTimes(1);
    expect(setEditorText).toHaveBeenCalledWith("focus on tests");

    const childSm = pi.getChildSessionManager();
    expect(childSm).toBeDefined();
    if (!childSm) throw new Error("childSm should be defined");

    const entries = childSm.getEntries();
    const sourceEntry = entries.find(
      (e): e is CustomMessageEntry<SessionLinkSourceDetails> =>
        e.type === "custom_message" &&
        (e as CustomMessageEntry).customType === SESSION_LINK_SOURCE_TYPE,
    );

    expect(sourceEntry).toBeDefined();
    expect(sourceEntry?.display).toBe(true);

    const content =
      typeof sourceEntry?.content === "string" ? sourceEntry?.content : "";
    expect(content).toContain(
      `Session spawned from ${parentSm.getSessionId()}.`,
    );
    expect(content).toContain("## Last message in parent session");
    expect(content).toContain("First part\nSecond part");
    expect(content).not.toContain("read_session(");
    expect(content).not.toContain("Role: assistant");

    expect(sourceEntry?.details).toEqual({
      parentSessionId: parentSm.getSessionId(),
      goal: "focus on tests",
      linkType: "continue",
    });
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
      context: { sessionManager: parentSm },
    });

    await pi.command("spawn").execute("");

    const childSm = pi.getChildSessionManager();
    expect(childSm).toBeDefined();
    if (!childSm) throw new Error("childSm should be defined");

    const entries = childSm.getEntries();
    const sourceEntry = entries.find(
      (e): e is CustomMessageEntry =>
        e.type === "custom_message" &&
        (e as CustomMessageEntry).customType === SESSION_LINK_SOURCE_TYPE,
    );

    expect(sourceEntry).toBeDefined();
    const content =
      typeof sourceEntry?.content === "string" ? sourceEntry?.content : "";
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
