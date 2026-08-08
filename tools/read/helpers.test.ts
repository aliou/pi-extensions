import { assert, describe, expect, it } from "vitest";
import { isSkillPath, truncateForPreview } from "./index";

describe("isSkillPath", () => {
  it("matches SKILL.md on posix paths", () => {
    assert.isTrue(isSkillPath("foo/bar/SKILL.md"));
  });

  it("is case-insensitive on the filename", () => {
    assert.isTrue(isSkillPath("foo/skill.md"));
    assert.isTrue(isSkillPath("Skill.Md"));
  });

  it("matches windows-style separators", () => {
    assert.isTrue(isSkillPath("foo\\bar\\SKILL.md"));
  });

  it("matches a bare SKILL.md", () => {
    assert.isTrue(isSkillPath("SKILL.md"));
  });

  it("rejects non-skill markdown and empty input", () => {
    assert.isFalse(isSkillPath("foo/bar.md"));
    assert.isFalse(isSkillPath("foo/SKILL.md.bak"));
    assert.isFalse(isSkillPath(null));
    assert.isFalse(isSkillPath(undefined));
    assert.isFalse(isSkillPath(""));
  });
});

describe("truncateForPreview", () => {
  it("leaves short descriptions untouched", () => {
    const short = "Short and sweet.";
    expect(truncateForPreview(short)).toBe(short);
  });

  it("truncates long descriptions with an ellipsis", () => {
    const long =
      "Vitest testing patterns and conventions. Use when writing, reviewing, or refactoring tests that use vitest. Covers config, assertions, mocking, fixtures, custom matchers, setup files, and TypeScript integration.";
    const out = truncateForPreview(long);
    expect(out.endsWith("...")).toBe(true);
    expect(out.length).toBeLessThan(long.length);
  });

  it("uses the first non-empty line", () => {
    const multiline = "\n\n  First line here.  \nSecond line.";
    expect(truncateForPreview(multiline)).toBe("First line here.");
  });
});
