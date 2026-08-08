import { describe, expect, it } from "vitest";
import { parseSkillDescription } from "./skill";

describe("parseSkillDescription", () => {
  it("returns the trimmed frontmatter description", () => {
    const content = `---
name: vitest
description:  Vitest testing patterns.  
---

# Body
`;
    expect(parseSkillDescription(content)).toBe("Vitest testing patterns.");
  });

  it("handles a multiline description", () => {
    const content = `---
description: |
  First line of the description.
  Second line.
---
`;
    expect(parseSkillDescription(content)).toContain(
      "First line of the description.",
    );
  });

  it("returns null when there is no frontmatter", () => {
    expect(parseSkillDescription("# just a body")).toBeNull();
  });

  it("returns null when description is missing or empty", () => {
    expect(parseSkillDescription("---\nname: x\n---\nbody")).toBeNull();
    expect(
      parseSkillDescription("---\ndescription: '   '\n---\nbody"),
    ).toBeNull();
  });

  it("returns null when description is not a string", () => {
    expect(parseSkillDescription("---\ndescription: 42\n---\nbody")).toBeNull();
  });

  it("returns null on invalid frontmatter", () => {
    expect(
      parseSkillDescription("---\ndescription: : :\n---\nbody"),
    ).toBeNull();
  });
});
