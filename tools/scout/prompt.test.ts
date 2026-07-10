import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import type { ScoutParamsType } from "./types";

const params: ScoutParamsType = {
  query: "Trace the model resolver fallback path.",
  cwd: "/tmp/pi-harness",
  context: "Inspect only packages/agent-kit and packages/models.",
};

const ctx = {} as ExtensionContext;

describe("scout prompt", () => {
  it("builds a bounded local-research prompt for GLM-5.2", () => {
    const result = buildPrompt(params, ctx, {
      provider: "synthetic",
      id: "hf:zai-org/GLM-5.2",
    });

    expect(result.text).toContain("bounded local codebase research task");
    expect(result.text).toContain("explicit gaps");
    expect(result.text).toContain(params.query);
    expect(result.text).toContain(params.cwd);
  });

  it("uses the generic prompt for unknown models", () => {
    const result = buildPrompt(params, ctx, {
      provider: "anthropic",
      id: "claude-opus-4-8",
    });

    expect(result.text).not.toContain("bounded local codebase research task");
    expect(result.text).toContain(params.query);
  });
});
