import { readdirSync, statSync } from "node:fs";
import { collapseHomePath } from "@harness/utils/path";

export interface SkillInfo {
  /** Directory name, e.g. "vitest". */
  name: string;
  /** Absolute path to SKILL.md, e.g. "/home/user/skills/vitest/SKILL.md". */
  fullPath: string;
  /** Tilde path to SKILL.md for insertion, e.g. "~/skills/vitest/SKILL.md". */
  path: string;
  /** Tilde path to directory, e.g. "~/skills/vitest". */
  directory: string;
}

/**
 * List skill directories under the given roots.
 * Only immediate subdirectories are included, sorted alphabetically.
 */
export function listSkills(skillsRoots: string[]): SkillInfo[] {
  const skills: SkillInfo[] = [];

  for (const root of skillsRoots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch (_error) {
      void _error;
      continue;
    }

    for (const name of entries) {
      const absolutePath = `${root}/${name}`;
      try {
        if (statSync(absolutePath).isDirectory()) {
          skills.push({
            name,
            fullPath: `${absolutePath}/SKILL.md`,
            path: collapseHomePath(`${absolutePath}/SKILL.md`),
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
