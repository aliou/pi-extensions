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
 * Map of provider -> modelId -> overrides to apply.
 */
export const MODEL_OVERRIDES: Record<string, Record<string, ModelOverride>> = {
  anthropic: {
    "claude-opus-4-6": { contextWindow: 272_000 },
    "claude-opus-4-7": { contextWindow: 272_000 },
    "claude-sonnet-4-6": { contextWindow: 272_000 },
  },
  "openai-codex": {
    "gpt-5.3-codex-spark": {
      cost: { input: 1.75, output: 14.0, cacheRead: 0.175 },
    },
  },
};
