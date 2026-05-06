import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveSearchPath,
  resolveSearchPaths,
  splitSearchPathList,
} from "./path-utils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("grep path utils", () => {
  it("splits whitespace-delimited paths", () => {
    expect(splitSearchPathList("src extensions docs README.md")).toEqual([
      "src",
      "extensions",
      "docs",
      "README.md",
    ]);
  });

  it("preserves escaped spaces when splitting", () => {
    expect(splitSearchPathList("docs/my\\ folder src")).toEqual([
      "docs/my folder",
      "src",
    ]);
  });

  it("resolves relative and home paths", () => {
    expect(resolveSearchPath("/tmp/project", "src")).toBe("/tmp/project/src");
    expect(resolveSearchPath("/tmp/project", "~/notes")).toContain("/notes");
  });

  it("keeps an existing path with spaces as a single target", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-grep-paths-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "docs with spaces"));

    expect(resolveSearchPaths(cwd, "docs with spaces")).toEqual([
      join(cwd, "docs with spaces"),
    ]);
  });

  it("splits a missing whitespace path when every token exists", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-grep-paths-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src"));
    await mkdir(join(cwd, "extensions"));
    await mkdir(join(cwd, "docs"));
    await writeFile(join(cwd, "README.md"), "hello", "utf8");

    expect(resolveSearchPaths(cwd, "src extensions docs README.md")).toEqual([
      join(cwd, "src"),
      join(cwd, "extensions"),
      join(cwd, "docs"),
      join(cwd, "README.md"),
    ]);
  });

  it("keeps the original missing path when not every token exists", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-grep-paths-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src"));

    expect(resolveSearchPaths(cwd, "src missing")).toEqual([
      join(cwd, "src missing"),
    ]);
  });
});
