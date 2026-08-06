import { describe, expect, test } from "vitest";
import { parseSkillsRoots } from "./config";

describe("parseSkillsRoots", () => {
  test("accepts objects with path and label", () => {
    expect(parseSkillsRoots([{ path: "~/skills", label: "personal" }])).toEqual(
      [{ path: "~/skills", label: "personal" }],
    );
  });

  test("trims path and label", () => {
    expect(
      parseSkillsRoots([{ path: "  ~/skills  ", label: "  personal  " }]),
    ).toEqual([{ path: "~/skills", label: "personal" }]);
  });

  test("rejects a non-array", () => {
    expect(() => parseSkillsRoots("~/skills")).toThrow(/array/);
  });

  test("rejects bare strings", () => {
    expect(() => parseSkillsRoots(["~/skills"])).toThrow(/skillsRoots\[0\]/);
  });

  test("rejects a missing label", () => {
    expect(() => parseSkillsRoots([{ path: "~/skills" }])).toThrow(/label/);
  });

  test("rejects a missing path", () => {
    expect(() => parseSkillsRoots([{ label: "personal" }])).toThrow(/path/);
  });

  test("rejects an empty path", () => {
    expect(() => parseSkillsRoots([{ path: "  ", label: "personal" }])).toThrow(
      /path/,
    );
  });
});
