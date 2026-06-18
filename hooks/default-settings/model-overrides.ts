import type { Api, Model } from "@earendil-works/pi-ai";

/**
 * Per-model overrides applied to models.json at session start.
 *
 * Supported override fields:
 *   contextWindow – override the context window size (tokens)
 *   cost          – override pricing (per million tokens, partial)
 */
export interface ModelOverride {
  contextWindow?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

/**
 * Hard cap applied to every model's context window. Models whose built-in
 * context window exceeds this value get a `modelOverrides[id].contextWindow`
 * entry written to models.json at session start, so the agent never sends
 * beyond this many tokens regardless of which model is selected.
 *
 * Derived dynamically from the registry, so new models are clamped without
 * needing a manual entry here.
 */
export const CONTEXT_WINDOW_CLAMP = 272_000;

/**
 * Explicit, hand-maintained per-model overrides that cannot be derived from a
 * rule (e.g. pricing fixes). Kept separate from the context-window clamp.
 */
export const EXPLICIT_MODEL_OVERRIDES: Record<
  string,
  Record<string, ModelOverride>
> = {
  "openai-codex": {
    "gpt-5.3-codex-spark": {
      cost: { input: 1.75, output: 14.0, cacheRead: 0.175 },
    },
  },
};

/**
 * Build a provider -> modelId -> { contextWindow } override map for every
 * model whose current context window exceeds the clamp.
 *
 * Reads from the resolved registry, so already-clamped models (from a prior
 * run) report the clamped value and produce no drift — making this idempotent.
 *
 * Note on raising the clamp: if you lower CONTEXT_WINDOW_CLAMP later, stale
 * higher overrides in models.json will be re-clamped on the next session. If
 * you raise it, previously-written lower overrides are NOT removed
 * automatically; clean models.json by hand if that matters.
 */
export function deriveContextWindowClampOverrides(
  models: Model<Api>[],
  clamp: number,
): Record<string, Record<string, ModelOverride>> {
  if (!Number.isFinite(clamp) || clamp <= 0) return {};

  const result: Record<string, Record<string, ModelOverride>> = {};

  for (const model of models) {
    const current = model.contextWindow;
    if (typeof current !== "number" || current <= clamp) continue;

    let providerEntry = result[model.provider];
    if (!providerEntry) {
      providerEntry = {};
      result[model.provider] = providerEntry;
    }
    providerEntry[model.id] = { contextWindow: clamp };
  }

  return result;
}

/**
 * Merge two override maps. `overrides` wins on field conflicts.
 */
export function mergeModelOverrides(
  base: Record<string, Record<string, ModelOverride>>,
  overrides: Record<string, Record<string, ModelOverride>>,
): Record<string, Record<string, ModelOverride>> {
  const result: Record<string, Record<string, ModelOverride>> = {};
  const mergeEntry = (a: ModelOverride, b: ModelOverride): ModelOverride => ({
    ...a,
    ...b,
    cost: { ...a.cost, ...b.cost },
  });

  for (const [provider, models] of Object.entries(base)) {
    result[provider] = { ...models };
  }
  for (const [provider, models] of Object.entries(overrides)) {
    let dest = result[provider];
    if (!dest) {
      dest = {};
      result[provider] = dest;
    }
    for (const [modelId, override] of Object.entries(models)) {
      dest[modelId] = dest[modelId]
        ? mergeEntry(dest[modelId], override)
        : { ...override };
    }
  }
  return result;
}
