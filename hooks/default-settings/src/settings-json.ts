import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface SettingsJsonConfig {
  enabledModels?: string[];
  [key: string]: unknown;
}

export function readSettingsJson(path: string): SettingsJsonConfig {
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SettingsJsonConfig;
  } catch (_error) {
    void _error;
    return {};
  }
}

export function writeSettingsJson(
  path: string,
  config: SettingsJsonConfig,
): void {
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
