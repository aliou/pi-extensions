import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { SubagentModelResolver } from "@harness/agent-kit/models";
import { get } from "@harness/model-registry";

const resolver = new SubagentModelResolver(get("ad:small:text"));

export function pickCompactionModel(modelRegistry: ModelRegistry) {
  return resolver.pick(modelRegistry);
}
