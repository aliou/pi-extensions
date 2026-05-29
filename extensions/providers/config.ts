import { ConfigLoader } from "@aliou/pi-utils-settings";
import type { ProviderKey } from "@harness/provider-usage";

// --- Types ---

export interface ProviderOverrides {
  warnings?: boolean;
}

export interface ProvidersConfig {
  providers?: Record<string, ProviderOverrides>;
  refreshIntervalMinutes?: number;
}

export interface ResolvedProviderSettings {
  warnings: boolean;
}

export interface ResolvedConfig {
  providers: Record<string, ResolvedProviderSettings>;
  refreshIntervalMinutes: number;
}

// --- Provider display names ---

export const PROVIDER_DISPLAY_NAMES: Record<ProviderKey, string> = {
  anthropic: "Claude",
  "openai-codex": "Codex",
  synthetic: "Synthetic",
};

// --- Defaults ---

const DEFAULT_PROVIDER_SETTINGS: ResolvedProviderSettings = {
  warnings: true,
};

const PROVIDER_KEYS: ProviderKey[] = ["anthropic", "openai-codex", "synthetic"];

const DEFAULT_CONFIG: ResolvedConfig = {
  providers: Object.fromEntries(
    PROVIDER_KEYS.map((key) => [key, { ...DEFAULT_PROVIDER_SETTINGS }]),
  ),
  refreshIntervalMinutes: 5,
};

// --- Loader ---

export const configLoader = new ConfigLoader<ProvidersConfig, ResolvedConfig>(
  "providers",
  DEFAULT_CONFIG,
  { scopes: ["global", "memory"] },
);

// --- Helpers ---

export function getProviderSettings(
  providerId: string,
): ResolvedProviderSettings {
  const config = configLoader.getConfig();
  return config.providers[providerId] ?? DEFAULT_PROVIDER_SETTINGS;
}

export function getProviderDisplayName(providerId: string): string {
  if (providerId in PROVIDER_DISPLAY_NAMES) {
    return PROVIDER_DISPLAY_NAMES[providerId as ProviderKey];
  }
  return providerId;
}
