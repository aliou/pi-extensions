/**
 * Per-model overrides applied to models.json at session start.
 *
 * Supported override fields:
 *   cost – override pricing (per million tokens, partial)
 */
export interface ModelOverride {
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

/**
 * Map of provider -> modelId -> overrides to apply.
 */
export const MODEL_OVERRIDES: Record<string, Record<string, ModelOverride>> = {
  "openai-codex": {
    "gpt-5.3-codex-spark": {
      cost: { input: 1.75, output: 14.0, cacheRead: 0.175 },
    },
  },
};
