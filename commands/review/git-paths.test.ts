import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readDefaultBranch } from "./git-paths";

vi.mock("node:fs", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs;
});

describe("readDefaultBranch", () => {
  beforeEach(() => {
    vol.reset();
  });

  it("reads upstream merge branch from git config", () => {
    vol.fromJSON({
      "/repo/.git/HEAD": "ref: refs/heads/feature\n",
      "/repo/.git/config": `[branch "feature"]
  remote = origin
  merge = refs/heads/trunk
`,
    });

    expect(readDefaultBranch("/repo/subdir")).toBe("trunk");
  });

  it("reads origin HEAD when no upstream is configured", () => {
    vol.fromJSON({
      "/repo/.git/HEAD": "ref: refs/heads/feature\n",
      "/repo/.git/config": "",
      "/repo/.git/refs/remotes/origin/HEAD": "ref: refs/remotes/origin/main\n",
    });

    expect(readDefaultBranch("/repo")).toBe("main");
  });
});
