import { createCommandContext } from "@harness/test-utils/pi-context";
import {
  createPiTestHarness,
  type PiTestHarness,
} from "@harness/test-utils/pi-test-harness";
import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import modesExtension from "../index";

function makeSessionManager(
  opts: { withMessages?: boolean } = {},
): SessionManager {
  const sm = SessionManager.inMemory();
  if (opts.withMessages) {
    sm.appendMessage({
      role: "user",
      content: "hello",
      timestamp: Date.now(),
    });
  }
  return sm;
}

async function emitSessionStart(
  pi: PiTestHarness,
  reason: string,
  sm: SessionManager,
  modelRegistry?: ExtensionCommandContext["modelRegistry"],
): Promise<void> {
  const handlers = pi.extension.handlers.get("session_start") ?? [];
  const ctx = createCommandContext({ sessionManager: sm, modelRegistry });
  for (const handler of handlers) {
    await handler({ type: "session_start", reason }, ctx);
  }
}

describe("restoreModeForSession - new session defaults", () => {
  let pi: PiTestHarness;
  let setModel: ReturnType<typeof vi.fn>;
  let setActiveTools: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    pi = await createPiTestHarness(modesExtension);
    setModel = vi.fn(async () => true);
    setActiveTools = vi.fn();
    pi.runtime.setModel = setModel as unknown as typeof pi.runtime.setModel;
    pi.runtime.getAllTools = vi.fn(
      () => [],
    ) as unknown as typeof pi.runtime.getAllTools;
    pi.runtime.setActiveTools =
      setActiveTools as unknown as typeof pi.runtime.setActiveTools;
    pi.runtime.sendMessage =
      vi.fn() as unknown as typeof pi.runtime.sendMessage;
    pi.runtime.appendEntry =
      vi.fn() as unknown as typeof pi.runtime.appendEntry;
  });

  function makeModelRegistry(): ExtensionCommandContext["modelRegistry"] {
    return {
      find: vi.fn((_provider: string, id: string) => ({
        provider: _provider,
        id,
      })),
    } as unknown as ExtensionCommandContext["modelRegistry"];
  }

  it("does NOT set model on new startup for balanced mode (no model configured)", async () => {
    const sm = makeSessionManager({ withMessages: false });
    await emitSessionStart(pi, "startup", sm, makeModelRegistry());
    expect(setModel).not.toHaveBeenCalled();
  });

  it("applies active tools on startup even when already in balanced mode", async () => {
    const sm = makeSessionManager({ withMessages: false });
    await emitSessionStart(pi, "startup", sm, makeModelRegistry());
    expect(setActiveTools).toHaveBeenCalled();
  });

  it("does NOT force defaults on resume (reason=resume, has messages)", async () => {
    const sm = makeSessionManager({ withMessages: true });
    await emitSessionStart(pi, "resume", sm);
    expect(setModel).not.toHaveBeenCalled();
  });

  it("does NOT force defaults when reopening existing session (startup + has messages)", async () => {
    const sm = makeSessionManager({ withMessages: true });
    await emitSessionStart(pi, "startup", sm);
    expect(setModel).not.toHaveBeenCalled();
  });

  it("does NOT force defaults for unknown future reason values", async () => {
    const sm = makeSessionManager({ withMessages: false });
    await emitSessionStart(pi, "some-future-reason", sm);
    expect(setModel).not.toHaveBeenCalled();
  });
});
