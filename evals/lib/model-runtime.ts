import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";

let modelRuntimePromise: Promise<ModelRuntime> | undefined;
let registryPromise: Promise<ModelRegistry> | undefined;

/** Returns the shared, refreshed model registry used by live eval harnesses. */
export function getEvalModelRegistry(): Promise<ModelRegistry> {
  registryPromise ??= getEvalModelRuntime()
    .then(async (runtime) => {
      const registry = new ModelRegistry(runtime);
      await registry.refresh();
      return registry;
    })
    .catch((error) => {
      registryPromise = undefined;
      throw error;
    });
  return registryPromise;
}

/** Returns the shared, refreshed model runtime used by live eval harnesses. */
export function getEvalModelRuntime(): Promise<ModelRuntime> {
  modelRuntimePromise ??= ModelRuntime.create()
    .then(async (runtime) => {
      await runtime.refresh();
      return runtime;
    })
    .catch((error) => {
      modelRuntimePromise = undefined;
      throw error;
    });
  return modelRuntimePromise;
}
