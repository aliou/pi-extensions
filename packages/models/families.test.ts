import { describe, expect, it } from "vitest";
import { knownModelFamily, type ModelIdentity, modelKey } from "./families";

function model(provider: string, id: string): ModelIdentity {
  return { provider, id };
}

describe("model family helpers", () => {
  it("formats model keys", () => {
    expect(modelKey(model("openai-codex", "gpt-5.5"))).toBe(
      "openai-codex/gpt-5.5",
    );
  });

  it.each([
    model("openai-codex", "gpt-5.5"),
    model("openrouter", "openai/gpt-5.5"),
  ])("recognizes GPT-5.5 variants: $provider/$id", (candidate) => {
    expect(knownModelFamily(candidate)).toBe("gpt-5.5");
  });

  it.each([
    [model("openai-codex", "gpt-5.6"), "gpt-5.6"],
    [model("openai-codex", "gpt-5.6-sol"), "gpt-5.6-sol"],
    [model("openrouter", "openai/gpt-5.6-terra"), "gpt-5.6-terra"],
    [model("openai-codex", "gpt-5.6-luna"), "gpt-5.6-luna"],
  ] as const)("recognizes GPT-5.6 variants: $0", (candidate, family) => {
    expect(knownModelFamily(candidate)).toBe(family);
  });

  it.each([
    model("synthetic", "hf:zai-org/GLM-4.7-Flash"),
    model("zai", "glm-4.7-flash-fast"),
  ])("recognizes GLM-4.7-Flash variants: $provider/$id", (candidate) => {
    expect(knownModelFamily(candidate)).toBe("glm-4.7-flash");
  });

  it.each([
    model("neuralwatt", "glm-5.2"),
    model("neuralwatt", "glm-5.2-fast"),
    model("neuralwatt", "glm-5.2-short-fast"),
    model("synthetic", "hf:zai-org/GLM-5.2"),
  ])("recognizes GLM-5.2 variants: $provider/$id", (candidate) => {
    expect(knownModelFamily(candidate)).toBe("glm-5.2");
  });

  it.each([
    model("neuralwatt", "kimi-k2.7-code"),
    model("synthetic", "hf:moonshotai/Kimi-K2.7-Code"),
  ])("recognizes Kimi K2.7 Code variants: $provider/$id", (candidate) => {
    expect(knownModelFamily(candidate)).toBe("kimi-k2.7-code");
  });

  it("returns undefined for unknown model families", () => {
    expect(knownModelFamily(model("anthropic", "claude-opus-4-8"))).toBe(
      undefined,
    );
    expect(knownModelFamily(model("zai", "glm-4.7"))).toBe(undefined);
    expect(knownModelFamily(model("openai-codex", "gpt-5.4-mini"))).toBe(
      undefined,
    );
  });
});
