import { describe, expect, it } from "vitest";
import { defaultModelRosters } from "./groups";
import type { ModelPreference } from "./types";

describe("defaultModelRosters", () => {
  it("maps all OpenAI Codex candidates to model quota refs", () => {
    const openAiCandidates = allCandidates().filter(
      (candidate) => candidate.provider === "openai-codex",
    );

    expect(openAiCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: "gpt-5.3-codex-spark" }),
        expect.objectContaining({ model: "gpt-5.4-mini" }),
        expect.objectContaining({ model: "gpt-5.5" }),
      ]),
    );

    for (const candidate of openAiCandidates) {
      expect(candidate.quotaRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "provider" }),
          expect.objectContaining({ kind: "model" }),
        ]),
      );
    }
  });

  it("maps Anthropic Opus and Sonnet candidates to scoped quota refs", () => {
    const anthropicCandidates = allCandidates().filter(
      (candidate) => candidate.provider === "anthropic",
    );

    for (const candidate of anthropicCandidates) {
      const expectedScope = candidate.model.includes("opus")
        ? "opus"
        : "sonnet";
      expect(candidate.quotaRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "provider" }),
          expect.objectContaining({ kind: "model", scopes: [expectedScope] }),
        ]),
      );
    }
  });

  it("only references model ids available from listed providers", () => {
    const availableByProvider = {
      anthropic: new Set(["claude-opus-4-8", "claude-sonnet-4-6"]),
      neuralwatt: new Set([
        "glm-5-fast",
        "glm-5.1",
        "glm-5.1-fast",
        "kimi-k2.6",
        "kimi-k2.6-fast",
        "kimi-k2.7-code",
        "qwen3.5-397b",
        "qwen3.6-35b-fast",
      ]),
      "openai-codex": new Set([
        "gpt-5.3-codex-spark",
        "gpt-5.4-mini",
        "gpt-5.5",
      ]),
      synthetic: new Set([
        "hf:MiniMaxAI/MiniMax-M3",
        "hf:moonshotai/Kimi-K2.6",
        "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
        "hf:Qwen/Qwen3.5-397B-A17B",
        "hf:zai-org/GLM-4.7-Flash",
      ]),
    };

    for (const candidate of allCandidates()) {
      const providerModels =
        availableByProvider[
          candidate.provider as keyof typeof availableByProvider
        ];
      expect(providerModels, candidate.provider).toBeDefined();
      expect(providerModels?.has(candidate.model), candidate.model).toBe(true);
    }
  });
});

function allCandidates(): ModelPreference[] {
  return Object.values(defaultModelRosters).flat();
}
