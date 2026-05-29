import type { SubagentModel } from "@harness/agent-kit/models";

export const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "openai-codex",
    model: "gpt-5.4",
    thinking: "medium",
  },
];
