export * from "./anthropic/index";
export * from "./core/index";
export * from "./neuralwatt/index";
export * from "./openai-codex/index";
export * from "./synthetic/index";

import { anthropicUsageClient } from "./anthropic/index";
import { ProviderUsageRegistry } from "./core/index";
import { neuralwattUsageClient } from "./neuralwatt/index";
import { openAiCodexUsageClient } from "./openai-codex/index";
import { syntheticUsageClient } from "./synthetic/index";

export const providerUsageClients = [
  anthropicUsageClient,
  openAiCodexUsageClient,
  syntheticUsageClient,
  neuralwattUsageClient,
] as const;

export const providerUsageRegistry = new ProviderUsageRegistry(
  providerUsageClients,
);
