import type { SubagentModel } from "../../../packages/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "neuralwatt",
    model: "glm-5-fast",
    thinking: "off",
    weight: 1,
  },
];
