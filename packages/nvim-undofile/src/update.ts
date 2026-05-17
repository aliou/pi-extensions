import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import { computeUndoHash, contentToUndoLines, undoLineCount } from "./hash";
import { parseUndofile } from "./parse";
import { DEFAULT_UNDODIR, getUndoFilePath } from "./path";
import { serializeUndofile } from "./serialize";
import type { Pos, UndoFile, UndoHeader, UpdateUndofileResult } from "./types";

const UH_CHANGED = 0x01;
const UHP_SAVE_NR = 1;

export type AppendUndoEntryOptions = {
  now?: Date;
};

type AppendUndoEntryFailureReason =
  | "hash-mismatch"
  | "line-count-mismatch"
  | "unsupported-tree";

type AppendUndoEntryResult =
  | { ok: true; file: UndoFile }
  | { ok: false; reason: AppendUndoEntryFailureReason };

function zeroPos(): Pos {
  return { lnum: 0, col: 0, coladd: 0 };
}

function onePos(): Pos {
  return { lnum: 1, col: 0, coladd: 0 };
}

function writeInt32Field(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value);
  return buffer;
}

function findHeader(file: UndoFile, seq: number): UndoHeader | undefined {
  return file.headers.find((header) => header.seq === seq);
}

function validateLatestTree(file: UndoFile): boolean {
  if (file.curHeadSeq !== 0) return false;
  if (file.newHeadSeq !== 0 && !findHeader(file, file.newHeadSeq)) return false;
  if (file.oldHeadSeq !== 0 && !findHeader(file, file.oldHeadSeq)) return false;

  const seen = new Set<number>();
  for (const header of file.headers) {
    if (header.seq <= 0 || seen.has(header.seq)) return false;
    seen.add(header.seq);
  }

  for (const header of file.headers) {
    for (const seq of [
      header.nextSeq,
      header.prevSeq,
      header.altNextSeq,
      header.altPrevSeq,
    ]) {
      if (seq !== 0 && !seen.has(seq)) return false;
    }
  }

  return true;
}

export function appendUndoEntryToUndofile(
  file: UndoFile,
  oldContent: string,
  newContent: string,
  options: AppendUndoEntryOptions = {},
): AppendUndoEntryResult {
  const oldHash = computeUndoHash(oldContent);
  if (!file.hash.equals(oldHash)) {
    return { ok: false, reason: "hash-mismatch" };
  }

  const oldLineCount = undoLineCount(oldContent);
  if (file.lineCount !== oldLineCount) {
    return { ok: false, reason: "line-count-mismatch" };
  }

  if (!validateLatestTree(file)) {
    return { ok: false, reason: "unsupported-tree" };
  }

  const newLineCount = undoLineCount(newContent);
  const newSeq = file.seqLast + 1;
  const nowSeconds = BigInt(
    Math.floor((options.now ?? new Date()).getTime() / 1000),
  );
  const oldNewHead =
    file.newHeadSeq === 0 ? undefined : findHeader(file, file.newHeadSeq);
  if (file.newHeadSeq !== 0 && !oldNewHead) {
    return { ok: false, reason: "unsupported-tree" };
  }
  if (oldNewHead && oldNewHead.prevSeq !== 0) {
    return { ok: false, reason: "unsupported-tree" };
  }

  if (oldNewHead) {
    oldNewHead.prevSeq = newSeq;
  }

  const header: UndoHeader = {
    nextSeq: file.newHeadSeq,
    prevSeq: 0,
    altNextSeq: 0,
    altPrevSeq: 0,
    seq: newSeq,
    cursor: onePos(),
    cursorVcol: -1,
    flags: UH_CHANGED,
    namedMarks: Array.from({ length: 26 }, () => zeroPos()),
    visual: {
      start: zeroPos(),
      end: zeroPos(),
      mode: 0,
      curswant: 0,
    },
    time: nowSeconds,
    optionalFields: [{ what: UHP_SAVE_NR, data: writeInt32Field(0) }],
    entries: [
      {
        top: 0,
        bot: newLineCount + 1,
        lcount: oldLineCount,
        lines: contentToUndoLines(oldContent),
      },
    ],
    extmarks: [],
  };

  file.headers.push(header);
  file.hash = computeUndoHash(newContent);
  file.lineCount = newLineCount;
  if (file.oldHeadSeq === 0) {
    file.oldHeadSeq = newSeq;
  }
  file.newHeadSeq = newSeq;
  file.curHeadSeq = 0;
  file.seqLast = newSeq;
  file.seqCur = newSeq;
  file.timeCur = nowSeconds + 1n;

  return { ok: true, file };
}

export async function updateUndofileForExternalWrite({
  filePath,
  oldContent,
  newContent,
  undodir = DEFAULT_UNDODIR,
}: {
  filePath: string;
  oldContent: string;
  newContent: string;
  undodir?: string;
}): Promise<UpdateUndofileResult> {
  if (oldContent.includes("\0") || newContent.includes("\0")) {
    return { ok: false, reason: "unsupported-content" };
  }

  const undoFilePath = await getUndoFilePath(filePath, undodir);

  let original: Buffer;
  try {
    original = await readFile(undoFilePath);
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    return {
      ok: false,
      undoFilePath,
      reason: code === "ENOENT" ? "missing" : "parse-error",
      error,
    };
  }

  let file: UndoFile;
  try {
    file = parseUndofile(original);
  } catch (error) {
    return { ok: false, undoFilePath, reason: "parse-error", error };
  }

  let roundtrip: Buffer;
  try {
    roundtrip = serializeUndofile(file);
  } catch (error) {
    return { ok: false, undoFilePath, reason: "roundtrip-mismatch", error };
  }
  if (!roundtrip.equals(original)) {
    return { ok: false, undoFilePath, reason: "roundtrip-mismatch" };
  }

  let updated: AppendUndoEntryResult;
  try {
    updated = appendUndoEntryToUndofile(file, oldContent, newContent);
  } catch (error) {
    return { ok: false, undoFilePath, reason: "unsupported-content", error };
  }

  if (!updated.ok) {
    return { ok: false, undoFilePath, reason: updated.reason };
  }

  const next = serializeUndofile(updated.file);
  const tempPath = `${undoFilePath}.pi-tmp-${process.pid}-${Date.now()}`;

  try {
    const currentStat = await stat(undoFilePath);
    const currentMode = currentStat.mode & 0o777;
    await mkdir(dirname(undoFilePath), { recursive: true });
    await writeFile(tempPath, next, { mode: currentMode || 0o600 });
    await rename(tempPath, undoFilePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    return { ok: false, undoFilePath, reason: "write-error", error };
  }

  return { ok: true, undoFilePath };
}
