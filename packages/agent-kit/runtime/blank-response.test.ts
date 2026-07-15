import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { buildBlankResponseError } from "./blank-response";

function assistant(
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.5",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: "stop",
    timestamp: 0,
    ...overrides,
  };
}

describe("buildBlankResponseError", () => {
  it("preserves context overflow and rejects resume guidance", () => {
    const message = assistant({
      stopReason: "error",
      errorMessage:
        "Codex error: Your input exceeds the context window of this model.",
    });

    const error = buildBlankResponseError(message, "reviewer");

    expect(error).toContain(message.errorMessage);
    expect(error).toContain("Start a new reviewer call with a narrower scope");
    expect(error).toContain("do not call resume_reviewer");
  });

  it("describes a blank stopped response", () => {
    expect(buildBlankResponseError(assistant(), "advisor")).toBe(
      'Subagent stopped with reason "stop" and produced no response.',
    );
  });

  it("describes a missing assistant response", () => {
    expect(buildBlankResponseError(undefined, "advisor")).toBe(
      "No response from subagent.",
    );
  });
});
