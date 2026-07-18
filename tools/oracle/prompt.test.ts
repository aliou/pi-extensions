import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  buildGlmOraclePrompt,
  buildGptOraclePrompt,
  buildPrompt,
} from "./prompt";
import type { OracleParamsType } from "./types";

const params: OracleParamsType = {
  task: "Design model-specific prompt compilation.",
  context: "Primary and fallback subagent models can differ.",
  files: ["packages/agent-kit/types.ts", "tools/oracle/prompt.ts"],
};

const ctx = {} as ExtensionContext;

describe("oracle prompt", () => {
  it.each([
    "gpt-5.5",
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
  ])("builds an outcome-first prompt for %s", (id) => {
    const result = buildPrompt(params, ctx, {
      provider: "openai-codex",
      id,
    });

    expect(result.text).toContain("outcome-first advisory shape");
    expect(result.text).toContain("one clear recommendation");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain(params.context);
    expect(result.text).toContain("- packages/agent-kit/types.ts");
  });

  it("builds an evidence-contract prompt for GLM-5.2", () => {
    const result = buildPrompt(params, ctx, {
      provider: "neuralwatt",
      id: "glm-5.2",
    });

    expect(result.text).toContain("Evidence contract");
    expect(result.text).toContain("Cite concrete files and line ranges");
    expect(result.text).toContain("not found");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain(params.context);
    expect(result.text).toContain("- tools/oracle/prompt.ts");
  });

  it("uses the generic prompt for unknown models", () => {
    const result = buildPrompt(params, ctx, {
      provider: "anthropic",
      id: "claude-opus-4-8",
    });

    expect(result.text).not.toContain("outcome-first advisory shape");
    expect(result.text).not.toContain("Evidence contract");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain(params.context);
  });

  it("keeps specialized builders deterministic", () => {
    expect(buildGptOraclePrompt(params)).toBe(buildGptOraclePrompt(params));
    expect(buildGlmOraclePrompt(params)).toBe(buildGlmOraclePrompt(params));
  });
});
