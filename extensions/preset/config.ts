/**
 * Preset configuration loading.
 *
 * Loads presets from:
 * - ~/.pi/agent/presets.json (global)
 * - .pi/presets.json (project-local, takes precedence)
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PresetsConfig } from "./types";

/** File structure with $schema and presets key */
interface PresetsFile {
  $schema?: string;
  presets?: PresetsConfig;
}

/**
 * Load and merge presets from global and project config files.
 * Project presets override global presets with the same name.
 */
export function loadPresets(cwd: string): PresetsConfig {
  const globalPath = join(homedir(), ".pi", "agent", "presets.json");
  const projectPath = join(cwd, ".pi", "presets.json");

  let globalPresets: PresetsConfig = {};
  let projectPresets: PresetsConfig = {};

  if (existsSync(globalPath)) {
    try {
      const content = readFileSync(globalPath, "utf-8");
      const file: PresetsFile = JSON.parse(content);
      globalPresets = file.presets ?? {};
    } catch (err) {
      console.error(`Failed to load global presets from ${globalPath}: ${err}`);
    }
  }

  if (existsSync(projectPath)) {
    try {
      const content = readFileSync(projectPath, "utf-8");
      const file: PresetsFile = JSON.parse(content);
      projectPresets = file.presets ?? {};
    } catch (err) {
      console.error(
        `Failed to load project presets from ${projectPath}: ${err}`,
      );
    }
  }

  return { ...globalPresets, ...projectPresets };
}
