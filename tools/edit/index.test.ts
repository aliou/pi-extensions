import { join } from "node:path";
import { createToolContext } from "@harness/test-utils/pi-context";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { vol } from "memfs";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import editExtension, { prepareEditArguments } from "./index";

vi.mock("node:fs", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs;
});

vi.mock("node:fs/promises", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs.promises;
});

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
}));

// Inject memfs operations into the native edit tool so it reads/writes
// from the in-memory volume instead of the real filesystem.
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const actual = await importOriginal<object>();
  const originalCreateEditTool = (actual as Record<string, unknown>)
    .createEditTool as typeof import("@earendil-works/pi-coding-agent").createEditTool;

  return {
    ...actual,
    createEditTool: (
      cwd: string,
      options?: Parameters<typeof originalCreateEditTool>[1],
    ) => {
      const memfsOps = {
        readFile: (path: string) =>
          vol.promises
            .readFile(path)
            .then((b) => (typeof b === "string" ? Buffer.from(b) : b)),
        writeFile: (path: string, content: string) =>
          vol.promises.writeFile(path, content),
        access: (path: string, mode?: number) =>
          vol.promises.access(path, mode),
      };
      return originalCreateEditTool(cwd, {
        ...options,
        operations: memfsOps as Parameters<
          typeof originalCreateEditTool
        >[1] extends { operations?: infer O } | undefined
          ? O
          : never,
      });
    },
  };
});

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ "/tmp/.keep": "" });
});

describe("defaults edit tool", () => {
  it("registers the edit tool", async () => {
    const pi = await createPiTestHarness(editExtension);

    expect(pi).toHaveRegisteredTool("edit");
  });

  it("strips empty-string edits in prepareArguments", async () => {
    const pi = await createPiTestHarness(editExtension);
    const tool = pi.tool("edit").registered;
    assert(tool.prepareArguments, "prepareArguments should be defined");

    const prepared = tool.prepareArguments({
      path: "file.txt",
      edits: [
        {
          oldText: "before",
          newText: "after",
        },
        "",
        {
          oldText: "alpha",
          newText: "beta",
        },
      ],
    });

    expect(prepared).toEqual({
      path: "file.txt",
      edits: [
        {
          oldText: "before",
          newText: "after",
        },
        {
          oldText: "alpha",
          newText: "beta",
        },
      ],
    });
  });

  it("calls native prepareArguments after sanitizing args", () => {
    const nativePrepareArguments = vi.fn((args) => ({
      ...args,
      path: "prepared.txt",
    }));

    const prepared = prepareEditArguments(
      {
        path: "file.txt",
        edits: [
          {
            oldText: "before",
            newText: "after",
          },
          "",
        ],
      },
      nativePrepareArguments,
    );

    expect(nativePrepareArguments).toHaveBeenCalledWith({
      path: "file.txt",
      edits: [
        {
          oldText: "before",
          newText: "after",
        },
      ],
    });
    expect(prepared).toEqual({
      path: "prepared.txt",
      edits: [
        {
          oldText: "before",
          newText: "after",
        },
      ],
    });
  });

  it("keeps native edit behavior after sanitizing args", async () => {
    const pi = await createPiTestHarness(editExtension);
    const tool = pi.tool("edit").registered;
    assert(tool.prepareArguments, "prepareArguments should be defined");

    const cwd = "/tmp/pi-edit-tool-cwd";
    vol.mkdirSync(cwd, { recursive: true });

    const relativePath = "sample.txt";
    const absolutePath = join(cwd, relativePath);
    vol.writeFileSync(absolutePath, "hello\nworld\n");

    const prepared = tool.prepareArguments({
      path: absolutePath,
      edits: [
        {
          oldText: "world",
          newText: "pi",
        },
        "",
      ],
    });

    const result = await tool.execute(
      "tc_1",
      prepared,
      undefined,
      undefined,
      createToolContext({ cwd }),
    );

    const content = vol.readFileSync(absolutePath, "utf8") as string;

    expect(content).toBe("hello\npi\n");
    expect(result.details).toMatchObject({
      diff: expect.stringContaining("+2 pi"),
    });
  });
});
