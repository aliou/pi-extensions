/**
 * Map of provider -> modelId -> desired context window size in tokens.
 */
export const CONTEXT_WINDOW_OVERRIDES: Record<
  string,
  Record<string, number>
> = {
  anthropic: {
    "claude-opus-4-6": 272_000,
    "claude-opus-4-7": 272_000,
    "claude-sonnet-4-6": 272_000,
  },
};
