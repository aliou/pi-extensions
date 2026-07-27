import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { collapseHomePath, expandHomePath } from "@harness/utils/path";
import { deriveRootLabel, type SkillsRoot } from "./skills";

/** A skillsRoots entry: a bare path, or a path with an explicit label override. */
export type SkillsRootConfig = string | { path: string; label?: string };

export interface CompletionConfig {
  /** Root directories containing skill folders, e.g. ["~/skills"]. */
  skillsRoots?: SkillsRootConfig[];
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
  /** Existing roots, each resolved to an absolute path with a display label. */
  valid: SkillsRoot[];
  /** Configured paths that don't exist on disk (tilde-shortened for display). */
  missing: string[];
}

/** Resolve a single config entry to a label, honoring an explicit override. */
function resolveRootLabel(entry: SkillsRootConfig): string {
  if (typeof entry !== "string") {
    const label = entry.label?.trim();
    if (label) return label;
  }
  const rawPath = typeof entry === "string" ? entry : entry.path;
  return deriveRootLabel(rawPath);
}

/**
 * Resolve the configured skills roots.
 * Returns valid (existing) roots with labels and missing (non-existing) paths separately.
 */
export function resolveSkillsRoots(): ResolvedSkillsRoots {
  const config = readCompletionConfig();
  const roots = config.skillsRoots;

  if (!roots || roots.length === 0) {
    return { valid: [], missing: [] };
  }

  const valid: SkillsRoot[] = [];
  const missing: string[] = [];

  for (const entry of roots) {
    const rawPath = typeof entry === "string" ? entry : entry.path;
    const label = resolveRootLabel(entry);
    const absolute = expandHomePath(rawPath);
    if (existsSync(absolute)) {
      valid.push({ path: absolute, label });
    } else {
      missing.push(`${label}:${collapseHomePath(absolute)}`);
    }
  }

  return { valid, missing };
}
