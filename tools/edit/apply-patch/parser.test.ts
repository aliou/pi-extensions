import { describe, expect, it } from "vitest";

import { ApplyPatchParseError, parsePatch } from "./parser";
import type { Hunk, ParseResult } from "./types";

/** Get the single hunk of a parsed patch, failing the test if absent. */
function onlyHunk(result: ParseResult): Hunk {
  const h = result.hunks[0];
  if (!h) throw new Error("expected one hunk");
  return h;
}

function wrap(body: string): string {
  return `*** Begin Patch\n${body}\n*** End Patch`;
}

describe("parsePatch", () => {
  it("parses an add file hunk", () => {
    const result = parsePatch(wrap("*** Add File: foo\n+hi\n+there"));
    expect(result.hunks).toEqual([
      { type: "add", path: "foo", contents: "hi\nthere\n" },
    ]);
  });

  it("parses a delete file hunk", () => {
    const result = parsePatch(wrap("*** Delete File: gone.txt"));
    expect(result.hunks).toEqual([{ type: "delete", path: "gone.txt" }]);
  });

  it("parses an update file hunk with context", () => {
    const result = parsePatch(
      wrap("*** Update File: test.py\n@@ def f():\n-    pass\n+    return 123"),
    );
    expect(result.hunks).toEqual([
      {
        type: "update",
        path: "test.py",
        movePath: undefined,
        chunks: [
          {
            changeContext: "def f():",
            oldLines: ["    pass"],
            newLines: ["    return 123"],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it("parses an update with move", () => {
    const result = parsePatch(
      wrap("*** Update File: a.py\n*** Move to: b.py\n@@\n-old\n+new"),
    );
    expect(result.hunks).toEqual([
      {
        type: "update",
        path: "a.py",
        movePath: "b.py",
        chunks: [
          {
            changeContext: null,
            oldLines: ["old"],
            newLines: ["new"],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it("parses an update hunk without an explicit @@ header", () => {
    const result = parsePatch(
      wrap("*** Update File: file2.py\n import foo\n+bar"),
    );
    expect(result.hunks).toEqual([
      {
        type: "update",
        path: "file2.py",
        movePath: undefined,
        chunks: [
          {
            changeContext: null,
            oldLines: ["import foo"],
            newLines: ["import foo", "bar"],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it("parses multiple chunks in one update hunk", () => {
    const result = parsePatch(
      wrap(
        "*** Update File: multi.txt\n@@\n foo\n-bar\n+BAR\n@@\n baz\n-qux\n+QUX",
      ),
    );
    expect(result.hunks).toHaveLength(1);
    const hunk = onlyHunk(result);
    expect(hunk.type).toBe("update");
    if (hunk.type !== "update") return;
    expect(hunk.chunks).toEqual([
      {
        changeContext: null,
        oldLines: ["foo", "bar"],
        newLines: ["foo", "BAR"],
        isEndOfFile: false,
      },
      {
        changeContext: null,
        oldLines: ["baz", "qux"],
        newLines: ["baz", "QUX"],
        isEndOfFile: false,
      },
    ]);
  });

  it("parses the *** End of File marker", () => {
    const result = parsePatch(
      wrap("*** Update File: file.txt\n@@\n+quux\n*** End of File"),
    );
    const hunk = onlyHunk(result);
    if (hunk.type !== "update") throw new Error("expected update");
    expect(hunk.chunks).toEqual([
      {
        changeContext: null,
        oldLines: [],
        newLines: ["quux"],
        isEndOfFile: true,
      },
    ]);
  });

  it("preserves bare empty update lines as context", () => {
    const result = parsePatch(
      wrap("*** Update File: file.txt\n@@\n context before\n\n context after"),
    );
    const hunk = onlyHunk(result);
    if (hunk.type !== "update") throw new Error("expected update");
    expect(hunk.chunks[0]).toEqual({
      changeContext: null,
      oldLines: ["context before", "", "context after"],
      newLines: ["context before", "", "context after"],
      isEndOfFile: false,
    });
  });

  it("parses the environment id preamble", () => {
    const result = parsePatch(
      wrap("*** Environment ID: remote\n*** Add File: hello.txt\n+hello"),
    );
    expect(result.environmentId).toBe("remote");
  });

  it("combines add, update, and delete in one patch", () => {
    const result = parsePatch(
      wrap(
        "*** Add File: one.txt\n+content\n*** Delete File: two.txt\n*** Update File: three.txt\n@@\n-old\n+new",
      ),
    );
    expect(result.hunks).toEqual([
      { type: "add", path: "one.txt", contents: "content\n" },
      { type: "delete", path: "two.txt" },
      {
        type: "update",
        path: "three.txt",
        movePath: undefined,
        chunks: [
          {
            changeContext: null,
            oldLines: ["old"],
            newLines: ["new"],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it("accepts CRLF line endings", () => {
    const result = parsePatch(
      "*** Begin Patch\r\n*** Update File: file.txt\r\n@@\r\n-old\r\n+new\r\n*** End Patch\r\n",
    );
    const hunk = onlyHunk(result);
    if (hunk.type !== "update") throw new Error("expected update");
    expect(hunk.chunks[0]).toEqual({
      changeContext: null,
      oldLines: ["old"],
      newLines: ["new"],
      isEndOfFile: false,
    });
  });

  it("strips a heredoc wrapper (lenient)", () => {
    const patch = "*** Begin Patch\n*** Add File: foo\n+hi\n*** End Patch";
    const result = parsePatch(`<<'EOF'\n${patch}\nEOF\n`);
    expect(result.hunks).toEqual([
      { type: "add", path: "foo", contents: "hi\n" },
    ]);
  });

  it("errors when the first line is not Begin Patch", () => {
    expect(() => parsePatch("bad")).toThrow(ApplyPatchParseError);
    expect(() => parsePatch("bad")).toThrow(
      /first line of the patch must be '\*\*\* Begin Patch'/,
    );
  });

  it("errors when End Patch is missing", () => {
    expect(() => parsePatch("*** Begin Patch\n*** Add File: foo\n+hi")).toThrow(
      /last line of the patch must be '\*\*\* End Patch'/,
    );
  });

  it("errors on an empty update hunk", () => {
    expect(() =>
      parsePatch("*** Begin Patch\n*** Update File: test.py\n*** End Patch"),
    ).toThrow(/Update file hunk for path 'test.py' is empty/);
  });

  it("errors on an update hunk with no content lines", () => {
    expect(() =>
      parsePatch("*** Begin Patch\n*** Update File: f.txt\n@@\n*** End Patch"),
    ).toThrow(/Update hunk does not contain any lines/);
  });

  it("errors on an empty environment id", () => {
    expect(() =>
      parsePatch(
        "*** Begin Patch\n*** Environment ID:   \n*** Add File: f\n+x\n*** End Patch",
      ),
    ).toThrow(/environment_id cannot be empty/);
  });
});
