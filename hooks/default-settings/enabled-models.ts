import type { SettingsJsonConfig } from "./src/settings-json";

export const DEFAULT_ENABLED_MODELS: Array<readonly [string, string]> = [
  ["anthropic", "claude-opus-4-6"],
  ["anthropic", "claude-sonnet-4-6"],
  ["openai-codex", "gpt-5.4"],
  ["openai-codex", "gpt-5.4-mini"],
  ["openai-codex", "gpt-5.3-codex-spark"],
  ["openrouter", "google/gemini-3.1-pro-preview"],
  ["synthetic", "hf:zai-org/GLM-4.7-Flash"],
  ["neuralwatt", "glm-5.1-fast"],
  ["neuralwatt", "kimi-k2.5-fast"],
  ["neuralwatt", "kimi-k2.6-fast"],
  ["synthetic", "moonshotai/Kimi-K2.6"],
];

export function collectMissingEnabledModels(
  config: SettingsJsonConfig,
): string[] {
  const current = new Set(config.enabledModels ?? []);
  return DEFAULT_ENABLED_MODELS.map(formatModel).filter(
    (model) => !current.has(model),
  );
}

export function applyDefaultSettings(config: SettingsJsonConfig): void {
  const enabledModels = [...(config.enabledModels ?? [])];
  for (const model of DEFAULT_ENABLED_MODELS.map(formatModel)) {
    if (!enabledModels.includes(model)) enabledModels.push(model);
  }
  config.enabledModels = enabledModels;
}

export function formatEnabledModelLines(models: string[]): string[] {
  return models.map((model) => `- \`${model}\``);
}

function formatModel([provider, model]: readonly [string, string]): string {
  return `${provider}/${model}`;
}
