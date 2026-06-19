/**
 * Global autodocs settings.
 *
 * Stored at <agentDir>/extensions/autodocs.json, keyed by absolute project
 * directory path. A project is enabled by the presence of its entry (or an
 * ancestor's entry, so subdirectories inherit). Not committed: docs config
 * is machine-local, like trust-paths.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { AutodocsConfig, AutodocsEntry } from "./types";

/** Path to the global autodocs settings file. */
export function getAutodocsConfigPath(): string {
  return join(getAgentDir(), "extensions", "autodocs.json");
}

/** Read the settings file. Returns an empty config if missing or invalid. */
export function readAutodocsConfig(): AutodocsConfig {
  const path = getAutodocsConfigPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AutodocsConfig;
    }
    return {};
  } catch {
    return {};
  }
}

/** Write the settings file, creating parent directories as needed. */
export function writeAutodocsConfig(config: AutodocsConfig): void {
  const path = getAutodocsConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/**
 * Find the most specific enabled entry for a working directory.
 * Matches the entry whose key is the cwd itself or the closest ancestor.
 * Returns the resolved entry (with a concrete docsPath) or undefined.
 */
export function findProjectEntry(cwd: string): AutodocsEntry | undefined {
  const config = readAutodocsConfig();
  let bestKey: string | undefined;
  for (const key of Object.keys(config)) {
    if (key === cwd || cwd.startsWith(`${key}/`)) {
      if (bestKey === undefined || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey === undefined) return undefined;
  const entry = config[bestKey];
  if (!entry?.docsPath) return undefined;
  return { docsPath: entry.docsPath };
}

/** Whether autodocs is enabled for the given cwd (entry or ancestor). */
export function isEnabled(cwd: string): boolean {
  return findProjectEntry(cwd) !== undefined;
}

/** Absolute docs directory for a cwd, or undefined if not enabled. */
export function getDocsDir(cwd: string): string | undefined {
  const entry = findProjectEntry(cwd);
  if (!entry) return undefined;
  return resolve(cwd, entry.docsPath);
}

/** Enable a project by writing (or replacing) its entry. */
export function enableProject(cwd: string, docsPath: string): void {
  const config = readAutodocsConfig();
  config[cwd] = { docsPath };
  writeAutodocsConfig(config);
}

/** Disable a project by removing its exact entry (ancestors are untouched). */
export function disableProject(cwd: string): void {
  const config = readAutodocsConfig();
  if (!(cwd in config)) return;
  delete config[cwd];
  writeAutodocsConfig(config);
}

/**
 * Validate a docs path. Must be relative to the project root, non-empty,
 * and must not escape the project via "..".
 */
export function validateDocsPath(docsPath: string): string | undefined {
  const trimmed = docsPath.trim();
  if (!trimmed) return "Docs path cannot be empty.";
  if (isAbsolute(trimmed)) return "Docs path must be relative.";
  const normalized = normalize(trimmed);
  if (normalized.startsWith(".."))
    return "Docs path must not escape the project root.";
  return undefined;
}

/** Normalize a docs path: trim, strip trailing slashes, default to "docs". */
export function normalizeDocsPath(docsPath: string): string {
  const trimmed = docsPath.trim().replace(/\/+$/, "");
  return trimmed || "docs";
}
