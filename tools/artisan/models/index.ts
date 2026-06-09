import type { ModelCandidate } from "@harness/model-registry";

export const MODEL_CANDIDATES = [
  {
    provider: "anthropic",
    model: "claude-opus-4-8",
    thinking: "medium",
  } as ModelCandidate,
  {
    provider: "neuralwatt",
    model: "moonshotai/Kimi-K2.6",
    thinking: "medium",
  } as ModelCandidate,
  {
    provider: "synthetic",
    model: "hf:moonshotai/Kimi-K2.6",
    thinking: "medium",
  } as ModelCandidate,
  {
    provider: "neuralwatt",
    model: "Qwen/Qwen3.5-397B-A17B-FP8",
    thinking: "medium",
  } as ModelCandidate,
  {
    provider: "synthetic",
    model: "hf:Qwen/Qwen3.5-397B-A17B",
    thinking: "medium",
  } as ModelCandidate,
];
