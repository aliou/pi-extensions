import type { Api, Model } from "@earendil-works/pi-ai";
import {
  CredentialSynchronizationError,
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
    try {
      await runtime.setRuntimeApiKey(model.provider, apiKey);
    } catch (error) {
      // The credential is committed to the runtime's overlay even when this
      // throws; only the opportunistic local catalog refresh failed (e.g. a
      // provider extension's refreshModels callback erroring). Treat it as
      // non-fatal so a stale or broken provider catalog refresh cannot take
      // down subagent creation, matching Pi's own login/logout handling.
      if (!(error instanceof CredentialSynchronizationError)) throw error;
    }
  }

  return runtime;
}
