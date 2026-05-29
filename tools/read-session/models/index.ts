import type { SubagentModel } from "@harness/agent-kit/types";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "neuralwatt",
    model: "kimi-k2.5-fast",
    thinking: "off",
  },
  {
    provider: "neuralwatt",
    model: "kimi-k2.6-fast",
    thinking: "off",
  },
  {
    provider: "synthetic",
    model: "moonshotai/Kimi-K2.6",
    thinking: "off",
  },
  {
    provider: "openai-codex",
    model: "gpt-5.3-codex-spark",
    thinking: "off",
  },
];
