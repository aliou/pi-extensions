import type { ModelOverride } from "../model-overrides";
import type { ModelsJsonConfig } from "./models-json";

export interface DriftedModelOverride {
  provider: string;
  modelId: string;
  contextWindow?: { current: number | undefined; desired: number };
  cost?: Record<string, { current: number | undefined; desired: number }>;
}

export function collectDriftedModelOverrides(
  config: ModelsJsonConfig,
  overrides: Record<string, Record<string, ModelOverride>>,
): DriftedModelOverride[] {
  const result: DriftedModelOverride[] = [];

  for (const [provider, modelOverrides] of Object.entries(overrides)) {
    for (const [modelId, override] of Object.entries(modelOverrides)) {
      const modelEntry = config.providers[provider]?.modelOverrides?.[modelId];

      const drifted: DriftedModelOverride = {
        provider,
        modelId,
      };

      if (override.contextWindow !== undefined) {
        const current = modelEntry?.contextWindow;
        if (current !== override.contextWindow) {
          drifted.contextWindow = {
            current,
            desired: override.contextWindow,
          };
        }
      }

      if (override.cost !== undefined) {
        const currentCost = modelEntry?.cost;
        const driftedCost: Record<
          string,
          { current: number | undefined; desired: number }
        > = {};
        for (const [costKey, desired] of Object.entries(override.cost)) {
          if (desired === undefined) continue;
          const current = (currentCost as Record<string, number> | undefined)?.[
            costKey
          ];
          if (current !== desired) {
            driftedCost[costKey] = { current, desired };
          }
        }
        if (Object.keys(driftedCost).length > 0) {
          drifted.cost = driftedCost;
        }
      }

      if (drifted.contextWindow || drifted.cost) {
        result.push(drifted);
      }
    }
  }

  return result;
}

/**
 * Apply all overrides from config into the models.json structure.
 */
export function applyModelOverrides(
  config: ModelsJsonConfig,
  overrides: Record<string, Record<string, ModelOverride>>,
): void {
  for (const [provider, modelOverrides] of Object.entries(overrides)) {
    for (const [modelId, override] of Object.entries(modelOverrides)) {
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
      const modelEntry = providerConfig.modelOverrides[modelId];

      if (override.contextWindow !== undefined) {
        modelEntry.contextWindow = override.contextWindow;
      }
      if (override.cost !== undefined) {
        if (!modelEntry.cost) {
          modelEntry.cost = {};
        }
        for (const [costKey, val] of Object.entries(override.cost)) {
          if (val !== undefined) {
            (modelEntry.cost as Record<string, number>)[costKey] = val;
          }
        }
      }
    }
  }
}
