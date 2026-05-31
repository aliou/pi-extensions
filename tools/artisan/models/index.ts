// import registry from "@harness/model-registry";

import type { ModelCandidate } from "@harness/model-registry";

// export const MODEL_CANDIDATES = registry.get("ad:large:sota");
export const MODEL_CANDIDATES = [
  {
    provider: "anthropic",
    model: "claude-opus-4-8",
    thinking: "medium",
  } as ModelCandidate,
];
