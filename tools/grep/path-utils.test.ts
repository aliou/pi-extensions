import { join } from "node:path";
import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveSearchPath,
  resolveSearchPaths,
  splitSearchPathList,
} from "./path-utils";

vi.mock("node:fs", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs;
});

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
  homedir: () => "/home/user",
}));

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ "/tmp/.keep": "" });
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

  it("keeps an existing path with spaces as a single target", () => {
    const cwd = "/tmp/pi-grep-paths";
    vol.mkdirSync(join(cwd, "docs with spaces"), { recursive: true });

    expect(resolveSearchPaths(cwd, "docs with spaces")).toEqual([
      join(cwd, "docs with spaces"),
    ]);
  });

  it("splits a missing whitespace path when every token exists", () => {
    const cwd = "/tmp/pi-grep-paths";
    vol.mkdirSync(join(cwd, "src"), { recursive: true });
    vol.mkdirSync(join(cwd, "extensions"), { recursive: true });
    vol.mkdirSync(join(cwd, "docs"), { recursive: true });
    vol.writeFileSync(join(cwd, "README.md"), "hello");

    expect(resolveSearchPaths(cwd, "src extensions docs README.md")).toEqual([
      join(cwd, "src"),
      join(cwd, "extensions"),
      join(cwd, "docs"),
      join(cwd, "README.md"),
    ]);
  });

  it("keeps the original missing path when not every token exists", () => {
    const cwd = "/tmp/pi-grep-paths";
    vol.mkdirSync(join(cwd, "src"), { recursive: true });

    expect(resolveSearchPaths(cwd, "src missing")).toEqual([
      join(cwd, "src missing"),
    ]);
  });
});
