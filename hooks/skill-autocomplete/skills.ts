import { existsSync, readdirSync, statSync } from "node:fs";
import { collapseHomePath } from "@harness/utils/path";

export interface SkillInfo {
  /** Directory name, e.g. "vitest". */
  name: string;
  /** Absolute path to SKILL.md, e.g. "/home/user/skills/vitest/SKILL.md". */
  fullPath: string;
  /** Absolute skill directory used to resolve relative references. */
  baseDir: string;
  /** Tilde path to directory, e.g. "~/skills/vitest". */
  directory: string;
}

/**
 * List skill directories under the given roots.
 * Only immediate subdirectories are included, sorted alphabetically.
 */
export function listSkills(skillsRoots: string[]): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const seenNames = new Set<string>();

  for (const root of skillsRoots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch (_error) {
      void _error;
      continue;
    }

    for (const name of entries) {
      if (seenNames.has(name)) continue;

      const absolutePath = `${root}/${name}`;
      const fullPath = `${absolutePath}/SKILL.md`;
      try {
        if (statSync(absolutePath).isDirectory() && existsSync(fullPath)) {
          seenNames.add(name);
          skills.push({
            name,
            fullPath,
            baseDir: absolutePath,
            directory: collapseHomePath(absolutePath),
          });
        }
      } catch (_error) {
        void _error;
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
