import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { expandHomePath } from "@harness/utils/path";
import type { TrustPathsConfig } from "./types";

/** Path to the trust-paths config file. */
export function getTrustPathsConfigPath(): string {
  return join(getAgentDir(), "extensions", "trust-paths.json");
}

/** Read the trust-paths config. Returns an empty config if the file doesn't exist. */
export function readTrustPathsConfig(): TrustPathsConfig {
  const path = getTrustPathsConfigPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as TrustPathsConfig;
  } catch {
    return {};
  }
}

/**
 * Resolve trusted path prefixes from config to absolute form.
 * Paths starting with `~` are expanded; others are used as-is.
 */
export function resolveTrustedPaths(config: TrustPathsConfig): string[] {
  if (!config.trustedPaths) return [];
  return config.trustedPaths.map((p) => expandHomePath(p));
}

/**
 * Check whether a directory matches any trusted path prefix.
 * A directory is trusted if its canonical path starts with any
 * of the configured trusted path prefixes.
 */
export function isTrustedPath(cwd: string, trustedPrefixes: string[]): boolean {
  for (const prefix of trustedPrefixes) {
    if (cwd === prefix || cwd.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}
