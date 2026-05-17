import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendUndoEntryToUndofile,
  computeUndoHash,
  getUndoFilePath,
  parseUndofile,
  serializeUndofile,
  updateUndofileForExternalWrite,
} from "../src/index";
import type { UndoFile } from "../src/types";

const tempDirs: string[] = [];

function emptyUndofile(content: string): UndoFile {
  return {
    hash: computeUndoHash(content),
    lineCount:
      content === "" ? 1 : content.replace(/\n$/, "").split("\n").length,
    uLine: Buffer.alloc(0),
    uLineLnum: 0,
    uLineColnr: 0,
    oldHeadSeq: 0,
    newHeadSeq: 0,
    curHeadSeq: 0,
    seqLast: 0,
    seqCur: 0,
    timeCur: 0n,
    optionalFields: [{ what: 1, data: Buffer.alloc(4) }],
    headers: [],
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("nvim undofile update", () => {
  it("roundtrips a minimal undofile", () => {
    const file = emptyUndofile("hello\nworld\n");
    const serialized = serializeUndofile(file);
    const parsed = parseUndofile(serialized);

    expect(serializeUndofile(parsed)).toEqual(serialized);
  });

  it("appends a whole-file undo header", () => {
    const file = emptyUndofile("old\ntext\n");
    const updated = appendUndoEntryToUndofile(
      file,
      "old\ntext\n",
      "new\ntext\n",
      {
        now: new Date("2026-01-01T00:00:00Z"),
      },
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.file.headers).toHaveLength(1);
    expect(updated.file.newHeadSeq).toBe(1);
    expect(updated.file.curHeadSeq).toBe(0);
    expect(updated.file.seqLast).toBe(1);
    expect(updated.file.lineCount).toBe(2);
    expect(updated.file.hash).toEqual(computeUndoHash("new\ntext\n"));

    const header = updated.file.headers[0];
    expect(header).toMatchObject({ seq: 1, nextSeq: 0, prevSeq: 0, flags: 1 });
    expect(header?.entries[0]).toMatchObject({ top: 0, bot: 3, lcount: 2 });
    expect(
      header?.entries[0]?.lines.map((line) => line.toString("utf8")),
    ).toEqual(["old", "text"]);
  });

  it("updates an undofile on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nvim-undofile-"));
    tempDirs.push(dir);
    const undoDir = join(dir, "undo");
    const filePath = join(dir, "sample.txt");
    await writeFile(filePath, "old\n", "utf8");

    const undoFilePath = await getUndoFilePath(filePath, undoDir);
    await mkdir(undoDir, { recursive: true });
    await writeFile(undoFilePath, serializeUndofile(emptyUndofile("old\n")));

    const result = await updateUndofileForExternalWrite({
      filePath,
      oldContent: "old\n",
      newContent: "new\n",
      undodir: undoDir,
    });

    expect(result).toMatchObject({ ok: true, undoFilePath });

    const undoFile = await readFile(undoFilePath);
    const parsed = parseUndofile(undoFile);
    expect(parsed.hash).toEqual(computeUndoHash("new\n"));
    expect(parsed.headers).toHaveLength(1);
    expect(parsed.headers[0]?.entries[0]?.lines[0]?.toString("utf8")).toBe(
      "old",
    );
  });

  it("does not update when the old hash does not match", () => {
    const result = appendUndoEntryToUndofile(
      emptyUndofile("actual\n"),
      "expected\n",
      "new\n",
    );

    expect(result).toEqual({ ok: false, reason: "hash-mismatch" });
  });
});
