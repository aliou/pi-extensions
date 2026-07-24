import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { describe, expect, it, vi } from "vitest";
import bashExtension from "./index";

describe("bash override", () => {
  it("forwards Pi session context to the delegated bash definition", async () => {
    const pi = await createPiTestHarness(bashExtension);
    const tool = pi.tool("bash").registered;
    const ctx = {
      cwd: "/tmp",
      sessionManager: {
        getSessionId: vi.fn(() => "session-82"),
        getSessionFile: vi.fn(() => "/tmp/session-82.jsonl"),
      },
      model: { provider: "test-provider", id: "test-model" },
      thinkingLevel: "high",
    } as unknown as ExtensionContext;

    const result = await tool.execute(
      "tc_1",
      {
        command:
          'printf "%s|%s|%s|%s|%s" "$PI_SESSION_ID" "$PI_SESSION_FILE" "$PI_PROVIDER" "$PI_MODEL" "$PI_REASONING_LEVEL"',
      },
      undefined,
      undefined,
      ctx,
    );

    expect(result.content).toEqual([
      {
        type: "text",
        text: "session-82|/tmp/session-82.jsonl|test-provider|test-model|high",
      },
    ]);
  });
});
