import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { FastModelCandidate } from "./types";

export const FAST_MODEL_CANDIDATES: FastModelCandidate[] = [
  { provider: "neuralwatt", id: "kimi-k2.6-fast" },
  { provider: "synthetic", id: "syn:small:text" },
  { provider: "openai-codex", id: "gpt-5.6-luna" },
];

export function findFirstAvailableFastModel(
  registry: ModelRegistry,
  candidates: FastModelCandidate[] = FAST_MODEL_CANDIDATES,
): Model<Api> | undefined {
  for (const candidate of candidates) {
    const model = registry.find(candidate.provider, candidate.id);
    if (model && registry.hasConfiguredAuth(model)) {
      return model as Model<Api>;
    }
  }
  return undefined;
}

export function isSameModel(a: Model<Api>, b: Model<Api>): boolean {
  return a.provider === b.provider && a.id === b.id;
}
