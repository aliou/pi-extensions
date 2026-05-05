import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolContext } from "@harness/test-utils/pi-context";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { afterEach, assert, describe, expect, it, vi } from "vitest";
import editExtension, { prepareEditArguments } from "./index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
  tempDirs.length = 0;
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

    const cwd = await mkdtemp(join(tmpdir(), "pi-edit-tool-"));
    tempDirs.push(cwd);

    const relativePath = "sample.txt";
    const absolutePath = join(cwd, relativePath);
    await writeFile(absolutePath, "hello\nworld\n", "utf8");

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

    const content = await readFile(absolutePath, "utf8");

    expect(content).toBe("hello\npi\n");
    expect(result.details).toMatchObject({
      diff: expect.stringContaining("+2 pi"),
    });
  });
});
