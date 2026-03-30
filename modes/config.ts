import { ConfigLoader } from "@aliou/pi-utils-settings";

export interface ModeToolOverrideConfig {
  allow?: string[];
  deny?: string[];
}

export interface ModesConfig {
  tools?: Record<string, ModeToolOverrideConfig>;
}

export interface ResolvedModesConfig {
  tools: Record<string, ModeToolOverrideConfig>;
}

const DEFAULT_CONFIG: ResolvedModesConfig = {
  tools: {},
};

function normalizeList(value: string[] | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    seen.add(trimmed);
  }

  return [...seen];
}

export const configLoader = new ConfigLoader<ModesConfig, ResolvedModesConfig>(
  "modes",
  DEFAULT_CONFIG,
  {
    scopes: ["global", "local"],
  },
);

export function getModeToolOverride(modeName: string): {
  allow: Set<string>;
  deny: Set<string>;
} {
  const config = configLoader.getConfig();
  const rule = config.tools[modeName];

  return {
    allow: new Set(normalizeList(rule?.allow)),
    deny: new Set(normalizeList(rule?.deny)),
  };
}
