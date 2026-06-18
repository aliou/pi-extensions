import type { SettingsJsonConfig } from "./src/settings-json";

export const DEFAULT_ENABLED_MODELS: Array<readonly [string, string]> = [
  ["synthetic", "hf:moonshotai/Kimi-K2.6"],
  ["synthetic", "hf:zai-org/GLM-5.2"],
  ["neuralwatt", "glm-5.2"],
  ["neuralwatt", "kimi-k2.7-code"],
  ["neuralwatt", "glm-5.2-fast"],
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
