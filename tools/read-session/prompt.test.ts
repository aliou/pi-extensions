import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import type { ReadSessionParamsType } from "./types";

const params: ReadSessionParamsType = {
  targetSessionId: "019f4c6f",
  goal: "Extract the final database decision and the test command that ran.",
};

const ctx = {} as ExtensionContext;

describe("read-session prompt", () => {
  it("builds a bounded evidence-extraction prompt for GLM-4.7-Flash", () => {
    const result = buildPrompt(params, ctx, {
      provider: "synthetic",
      id: "hf:zai-org/GLM-4.7-Flash",
    });

    expect(result.text).toContain("bounded session-evidence extraction");
    expect(result.text).toContain('return "not found"');
    expect(result.text).toContain(params.targetSessionId);
    expect(result.text).toContain(params.goal);
  });

  it("builds a bounded research prompt for the GLM-5.2 fallback", () => {
    const result = buildPrompt(params, ctx, {
      provider: "neuralwatt",
      id: "glm-5.2-short-fast",
    });

    expect(result.text).toContain("bounded session research task");
    expect(result.text).toContain("direct evidence from inference");
    expect(result.text).toContain(params.goal);
  });

  it("uses the generic prompt for unknown models", () => {
    const result = buildPrompt(params, ctx, {
      provider: "anthropic",
      id: "claude-opus-4-8",
    });

    expect(result.text).not.toContain("bounded session-evidence extraction");
    expect(result.text).toContain(params.targetSessionId);
    expect(result.text).toContain(params.goal);
  });
});
