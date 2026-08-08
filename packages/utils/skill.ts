import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

/** Frontmatter shape for a `SKILL.md` file (Agent Skills spec). */
export interface SkillFrontmatter {
  description?: string;
  [key: string]: unknown;
}

/**
 * Parse the `description` field from a SKILL.md's YAML frontmatter.
 *
 * Uses Pi's own `parseFrontmatter` so the value matches what Pi extracts for
 * the system prompt. Returns `null` when the file has no frontmatter, when the
 * description is missing/empty, or when it is not a string.
 */
export function parseSkillDescription(content: string): string | null {
  try {
    const { frontmatter } = parseFrontmatter<SkillFrontmatter>(content);
    const description = frontmatter.description;
    if (typeof description !== "string") return null;
    const trimmed = description.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
}
