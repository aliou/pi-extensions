import type { SubagentModel } from "@harness/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "anthropic",
    model: "claude-opus-4-6",
    thinking: "medium",
    weight: 1,
  },
];
