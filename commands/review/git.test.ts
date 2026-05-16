import { getOrThrow } from "@harness/utils";
import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareDiffFile } from "./git";

vi.mock("node:fs", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs;
});

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
}));

interface ExecCall {
  command: string;
  args: string[];
  options: { cwd?: string; timeout?: number };
}

interface ExecResponse {
  code: number;
  stdout: string;
  stderr: string;
}

function createPi(responses: ExecResponse[]) {
  const calls: ExecCall[] = [];
  return {
    calls,
    pi: {
      exec: vi.fn(async (command: string, args: string[], options = {}) => {
        calls.push({ command, args, options });
        return responses.shift() ?? { code: 0, stdout: "", stderr: "" };
      }),
    },
  };
}

function success(stdout: string): ExecResponse {
  return { code: 0, stdout, stderr: "" };
}

describe("prepareDiffFile", () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({ "/tmp/.keep": "" });
  });

  it("writes the generated diff to a temp file", async () => {
    const diff = "diff --git a/a.ts b/a.ts\n+hello";
    const { pi } = createPi([success(diff), success("")]);

    const prepared = await prepareDiffFile(pi as never, "/repo", "main...HEAD");
    const result = getOrThrow(prepared);

    expect(result.originalContent).toBe(diff);
    expect(result.diffFile).toMatch(/^\/tmp\/pi-review-/);
    expect(vol.readFileSync(result.diffFile, "utf-8")).toBe(diff);
  });

  it("uses staged diff args", async () => {
    const { pi, calls } = createPi([
      success("diff --git a/a.ts b/a.ts\n+hello"),
    ]);

    const prepared = await prepareDiffFile(pi as never, "/repo", "--staged");
    getOrThrow(prepared);

    expect(calls[0]?.command).toBe("git");
    expect(calls[0]?.args.at(-2)).toBe("diff");
    expect(calls[0]?.args.at(-1)).toBe("--cached");
  });

  it("includes untracked files in non-staged reviews", async () => {
    const trackedDiff = "diff --git a/a.ts b/a.ts\n+tracked";
    const untrackedDiff = [
      "diff --git a/dev/null b/new.ts",
      "new file mode 100644",
      "index 0000000..1111111",
      "--- a/dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1 @@",
      "+untracked",
    ].join("\n");
    const { pi } = createPi([
      success(trackedDiff),
      success("new.ts\n"),
      { code: 1, stdout: untrackedDiff, stderr: "" },
    ]);

    const prepared = await prepareDiffFile(pi as never, "/repo", "main...HEAD");
    const result = getOrThrow(prepared);

    expect(result.originalContent).toContain(trackedDiff);
    expect(result.originalContent).toContain("diff --git a/new.ts b/new.ts");
    expect(result.originalContent).toContain("+untracked");
  });
});
