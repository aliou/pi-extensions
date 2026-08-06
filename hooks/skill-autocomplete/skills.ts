import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { collapseHomePath } from "@harness/utils/path";

interface SkillFrontmatter {
  description?: string;
  [key: string]: unknown;
}

/** A configured skill root, resolved to an absolute path with a display label. */
export interface SkillsRoot {
  /** Absolute path to the root directory containing skill folders. */
  path: string;
  /** Short label identifying this root, shown as a `[label]` prefix. */
  label: string;
}

export interface SkillInfo {
  /** Directory name, e.g. "vitest". */
  name: string;
  /** Description from the SKILL.md frontmatter. */
  description?: string;
  /** Absolute path to SKILL.md, e.g. "/home/user/skills/vitest/SKILL.md". */
  fullPath: string;
  /** Absolute skill directory used to resolve relative references. */
  baseDir: string;
  /** Tilde path to directory, e.g. "~/skills/vitest". */
  directory: string;
  /** Label of the root this skill was loaded from. */
  sourceLabel: string;
}

/**
 * List skill directories under the given roots.
 * Only immediate subdirectories are included, sorted alphabetically.
 */
export function listSkills(skillsRoots: SkillsRoot[]): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const seenNames = new Set<string>();

  for (const root of skillsRoots) {
    let entries: string[];
    try {
      entries = readdirSync(root.path);
    } catch (_error) {
      void _error;
      continue;
    }

    for (const name of entries) {
      if (seenNames.has(name)) continue;

      const absolutePath = `${root.path}/${name}`;
      const fullPath = `${absolutePath}/SKILL.md`;
      try {
        if (statSync(absolutePath).isDirectory() && existsSync(fullPath)) {
          seenNames.add(name);
          const { frontmatter } = parseFrontmatter<SkillFrontmatter>(
            readFileSync(fullPath, "utf-8"),
          );
          skills.push({
            name,
            description: frontmatter.description,
            fullPath,
            baseDir: absolutePath,
            directory: collapseHomePath(absolutePath),
            sourceLabel: root.label,
          });
        }
      } catch (_error) {
        void _error;
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
