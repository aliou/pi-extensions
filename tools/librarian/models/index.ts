import type { SubagentModel } from "@harness/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "synthetic",
    model: "hf:zai-org/GLM-4.7-Flash",
    thinking: "off",
  },
  {
    provider: "neuralwatt",
    model: "glm-5.1-fast",
    thinking: "off",
  },
  {
    provider: "openai-codex",
    model: "gpt-5.4-mini",
    thinking: "off",
  },
];
