import type { SubagentModel } from "@harness/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    thinking: "medium",
    weight: 1,
  },
  {
    provider: "openrouter",
    model: "~anthropic/claude-sonnet-latest",
    thinking: "medium",
    weight: 1,
  },
];
