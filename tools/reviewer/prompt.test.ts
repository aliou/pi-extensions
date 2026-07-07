import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import type { ReviewerParamsType } from "./types";

const params: ReviewerParamsType = {
  diff_description: "git diff --staged",
  instructions: "Focus on correctness and regressions.",
};

const ctx = {} as ExtensionContext;

describe("reviewer prompt", () => {
  it("builds a highest-impact review prompt for GPT-5.5", () => {
    const result = buildPrompt(params, ctx, {
      provider: "openai-codex",
      id: "gpt-5.5",
    });

    expect(result.text).toContain("highest-impact findings");
    expect(result.text).toContain("critical, high, medium, low");
    expect(result.text).toContain(params.diff_description);
    expect(result.text).toContain(params.instructions);
  });

  it("builds an evidence-contract review prompt for GLM-5.2", () => {
    const result = buildPrompt(params, ctx, {
      provider: "synthetic",
      id: "hf:zai-org/GLM-5.2",
    });

    expect(result.text).toContain("Evidence contract");
    expect(result.text).toContain("Cite concrete files and line ranges");
    expect(result.text).toContain(params.diff_description);
    expect(result.text).toContain(params.instructions);
  });
});
