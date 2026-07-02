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
        "glm-5.2",
        "glm-5.2-fast",
        "kimi-k2.7-code",
        "qwen3.5-397b",
        "qwen3.5-397b-fast",
        "qwen3.6-35b-fast",
      ]),
      "openai-codex": new Set([
        "gpt-5.3-codex-spark",
        "gpt-5.4-mini",
        "gpt-5.5",
      ]),
      synthetic: new Set([
        "hf:MiniMaxAI/MiniMax-M3",
        "hf:moonshotai/Kimi-K2.7-Code",
        "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
        "hf:Qwen/Qwen3.6-27B",
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

  it("only uses supported thinking levels for listed models", () => {
    const supportedThinking = {
      "anthropic/claude-opus-4-8": new Set(["medium"]),
      "anthropic/claude-sonnet-4-6": new Set(["medium"]),
      "neuralwatt/glm-5.2": new Set(["off", "high", "xhigh"]),
      "neuralwatt/glm-5.2-fast": new Set(["off"]),
      "neuralwatt/kimi-k2.7-code": new Set(["medium"]),
      "neuralwatt/qwen3.5-397b": new Set(["medium"]),
      "neuralwatt/qwen3.5-397b-fast": new Set(["off"]),
      "neuralwatt/qwen3.6-35b-fast": new Set(["off"]),
      "openai-codex/gpt-5.3-codex-spark": new Set(["off"]),
      "openai-codex/gpt-5.4-mini": new Set(["off", "low"]),
      "openai-codex/gpt-5.5": new Set(["low", "medium"]),
      "synthetic/hf:MiniMaxAI/MiniMax-M3": new Set(["medium"]),
      "synthetic/hf:moonshotai/Kimi-K2.7-Code": new Set(["medium"]),
      "synthetic/hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4": new Set([
        "off",
        "medium",
      ]),
      "synthetic/hf:Qwen/Qwen3.6-27B": new Set(["off", "medium"]),
      "synthetic/hf:zai-org/GLM-4.7-Flash": new Set(["off", "medium"]),
    };

    for (const candidate of allCandidates()) {
      const modelKey = `${candidate.provider}/${candidate.model}`;
      const levels =
        supportedThinking[modelKey as keyof typeof supportedThinking];
      expect(levels, modelKey).toBeDefined();
      expect(levels?.has(candidate.thinking), modelKey).toBe(true);
    }
  });
});

function allCandidates(): ModelPreference[] {
  return Object.values(defaultModelRosters).flat();
}
