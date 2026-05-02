import type { SubagentModel } from "../../../packages/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "openrouter",
    model: "google/gemini-3.1-pro-preview",
    thinking: "medium",
    weight: 1,
  },
];
