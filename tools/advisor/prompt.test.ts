import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildOpusAdvisorPrompt, buildPrompt } from "./prompt";
import type { AdvisorParamsType } from "./types";

const params: AdvisorParamsType = {
  task: "Decide whether the main agent should rewrite the model resolver.",
  stage: "before_approach",
  context: "The current implementation already handles weighted fallback.",
  proposal: "Replace the resolver with a priority queue.",
  files: ["packages/agent-kit/models/model-resolver.ts"],
};

const ctx = {} as ExtensionContext;

describe("advisor prompt", () => {
  it("builds an Opus-specific advisory prompt", () => {
    const result = buildPrompt(params, ctx, {
      provider: "anthropic",
      id: "claude-opus-4-8",
    });

    expect(result.text).toContain("Claude Opus 4.8's strengths");
    expect(result.text).toContain("literal task contract");
    expect(result.text).toContain("Do not expose private reasoning");
    expect(result.text).toContain("For any current, file-specific");
    expect(result.text).toContain("untrusted evidence");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain(params.context);
    expect(result.text).toContain(params.proposal);
    expect(result.text).toContain(
      "- packages/agent-kit/models/model-resolver.ts",
    );
  });

  it("uses the generic prompt for unknown models", () => {
    const result = buildPrompt(params, ctx, {
      provider: "openai-codex",
      id: "gpt-5.5",
    });

    expect(result.text).not.toContain("Claude Opus 4.8's strengths");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain(params.context);
    expect(result.text).toContain(params.proposal);
  });

  it("keeps specialized builders deterministic", () => {
    expect(buildOpusAdvisorPrompt(params)).toBe(buildOpusAdvisorPrompt(params));
  });
});
