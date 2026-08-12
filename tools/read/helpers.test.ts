import { assert, describe, it } from "vitest";
import { isSkillPath } from "./index";

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
