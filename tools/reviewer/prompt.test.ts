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
  it.each([
    "gpt-5.5",
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
  ])("builds a highest-impact review prompt for %s", (id) => {
    const result = buildPrompt(params, ctx, {
      provider: "openai-codex",
      id,
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
