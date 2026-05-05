import type { SubagentModel } from "@harness/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "neuralwatt",
    model: "kimi-k2.5-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "neuralwatt",
    model: "kimi-k2.6-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "neuralwatt",
    model: "qwen3.6-35b-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "synthetic",
    model: "moonshotai/Kimi-K2.6",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "openai-codex",
    model: "gpt-5.3-codex-spark",
    thinking: "off",
    weight: 1,
  },
];
