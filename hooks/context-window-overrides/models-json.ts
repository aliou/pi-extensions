import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface ModelsJsonConfig {
  providers: Record<
    string,
    {
      baseUrl?: string;
      apiKey?: string;
      headers?: Record<string, string>;
      modelOverrides?: Record<
        string,
        { contextWindow?: number; maxTokens?: number }
      >;
      [key: string]: unknown;
    }
  >;
}

export function readModelsJson(path: string): ModelsJsonConfig {
  if (!existsSync(path)) return { providers: {} };

  try {
    const config = JSON.parse(readFileSync(path, "utf-8")) as ModelsJsonConfig;
    if (!config.providers) config.providers = {};
    return config;
  } catch {
    return { providers: {} };
  }
}

export function writeModelsJson(path: string, config: ModelsJsonConfig): void {
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
