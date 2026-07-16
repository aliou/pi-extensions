import type { Api, Model } from "@earendil-works/pi-ai";
import {
  type ModelRegistry,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";

type CreateModelRuntime = typeof ModelRuntime.create;

/**
 * Build an SDK model runtime that inherits the selected provider's current
 * extension registration and resolved parent-session credential.
 */
export async function createSubagentModelRuntime(
  registry: ModelRegistry,
  model: Model<Api>,
  createRuntime: CreateModelRuntime = ModelRuntime.create,
): Promise<ModelRuntime> {
  const runtime = await createRuntime();
  const providerConfig = registry.getRegisteredProviderConfig(model.provider);
  if (providerConfig) {
    runtime.registerProvider(model.provider, providerConfig);
  }

  const apiKey = await registry.getApiKeyForProvider(model.provider);
  if (apiKey && !registry.isUsingOAuth(model)) {
    await runtime.setRuntimeApiKey(model.provider, apiKey);
  }

  return runtime;
}
