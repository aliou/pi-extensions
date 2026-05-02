import type { ModelsJsonConfig } from "./models-json";

export interface DriftedContextWindowOverride {
  provider: string;
  modelId: string;
  current: number | undefined;
  desired: number;
}

export function collectDriftedContextWindowOverrides(
  config: ModelsJsonConfig,
  overrides: Record<string, Record<string, number>>,
): DriftedContextWindowOverride[] {
  const drifted: DriftedContextWindowOverride[] = [];

  for (const [provider, modelOverrides] of Object.entries(overrides)) {
    for (const [modelId, desired] of Object.entries(modelOverrides)) {
      const current =
        config.providers[provider]?.modelOverrides?.[modelId]?.contextWindow;
      if (current !== desired) {
        drifted.push({ provider, modelId, current, desired });
      }
    }
  }

  return drifted;
}

export function applyContextWindowOverrides(
  config: ModelsJsonConfig,
  overrides: DriftedContextWindowOverride[],
): void {
  for (const { provider, modelId, desired } of overrides) {
    if (!config.providers[provider]) {
      config.providers[provider] = {};
    }
    const providerConfig = config.providers[provider];
    if (!providerConfig.modelOverrides) {
      providerConfig.modelOverrides = {};
    }
    if (!providerConfig.modelOverrides[modelId]) {
      providerConfig.modelOverrides[modelId] = {};
    }
    providerConfig.modelOverrides[modelId].contextWindow = desired;
  }
}
