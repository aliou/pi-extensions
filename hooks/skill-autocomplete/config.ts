import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { collapseHomePath, expandHomePath } from "@harness/utils/path";

export interface CompletionConfig {
  /** Root directories containing skill folders, e.g. ["~/skills"]. */
  skillsRoots?: string[];
}

/** Path to the shared completion config file. */
export function getCompletionConfigPath(): string {
  return join(getAgentDir(), "settings", "completion.json");
}

/** Read the completion config. Returns an empty object if the file doesn't exist. */
export function readCompletionConfig(): CompletionConfig {
  const path = getCompletionConfigPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CompletionConfig;
  } catch {
    return {};
  }
}

export interface ResolvedSkillsRoots {
  /** Absolute paths that exist on disk. */
  valid: string[];
  /** Configured paths that don't exist on disk (tilde-shortened for display). */
  missing: string[];
}

/**
 * Resolve the configured skills roots.
 * Returns valid (existing) and missing (non-existing) paths separately.
 */
export function resolveSkillsRoots(): ResolvedSkillsRoots {
  const config = readCompletionConfig();
  const roots = config.skillsRoots;

  if (!roots || roots.length === 0) {
    return { valid: [], missing: [] };
  }

  const valid: string[] = [];
  const missing: string[] = [];

  for (const root of roots) {
    const absolute = expandHomePath(root);
    if (existsSync(absolute)) {
      valid.push(absolute);
    } else {
      missing.push(collapseHomePath(absolute));
    }
  }

  return { valid, missing };
}
