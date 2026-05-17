import { BinaryReader } from "./binary";
import type {
  ExtmarkRecord,
  OptionalField,
  Pos,
  UndoEntry,
  UndoFile,
  UndoHeader,
  VisualInfo,
} from "./types";

const MAGIC = Buffer.from([
  0x56, 0x69, 0x6d, 0x9f, 0x55, 0x6e, 0x44, 0x6f, 0xe5,
]);
const VERSION = 3;
const UF_HEADER_MAGIC = 0x5fd0;
const UF_HEADER_END_MAGIC = 0xe7aa;
const UF_ENTRY_MAGIC = 0xf518;
const UF_ENTRY_END_MAGIC = 0x3581;
const NMARKS = 26;
const EXTMARK_STRUCT_SIZE = 48;

function readOptionalFields(reader: BinaryReader): OptionalField[] {
  const fields: OptionalField[] = [];

  while (true) {
    const length = reader.readUInt8();
    if (length === 0) return fields;

    const what = reader.readUInt8();
    fields.push({ what, data: reader.readBuffer(length) });
  }
}

function readPos(reader: BinaryReader): Pos {
  return {
    lnum: reader.readInt32BE(),
    col: reader.readInt32BE(),
    coladd: reader.readInt32BE(),
  };
}

function readVisual(reader: BinaryReader): VisualInfo {
  return {
    start: readPos(reader),
    end: readPos(reader),
    mode: reader.readInt32BE(),
    curswant: reader.readInt32BE(),
  };
}

function readEntry(reader: BinaryReader): UndoEntry {
  const top = reader.readInt32BE();
  const bot = reader.readInt32BE();
  const lcount = reader.readInt32BE();
  const size = reader.readInt32BE();

  if (size < 0) {
    throw new Error(`Invalid undo entry size: ${size}`);
  }

  const lines: Buffer[] = [];
  for (let i = 0; i < size; i++) {
    const lineLength = reader.readInt32BE();
    if (lineLength < 0) {
      throw new Error(`Invalid undo line length: ${lineLength}`);
    }
    lines.push(reader.readBuffer(lineLength));
  }

  return { top, bot, lcount, lines };
}

function readEntries(reader: BinaryReader): UndoEntry[] {
  const entries: UndoEntry[] = [];

  while (true) {
    const marker = reader.readUInt16BE();
    if (marker === UF_ENTRY_END_MAGIC) return entries;
    if (marker !== UF_ENTRY_MAGIC) {
      throw new Error(`Invalid undo entry marker: 0x${marker.toString(16)}`);
    }
    entries.push(readEntry(reader));
  }
}

function readExtmarks(reader: BinaryReader): ExtmarkRecord[] {
  const extmarks: ExtmarkRecord[] = [];

  while (true) {
    const marker = reader.readUInt16BE();
    if (marker === UF_ENTRY_END_MAGIC) return extmarks;
    if (marker !== UF_ENTRY_MAGIC) {
      throw new Error(`Invalid extmark marker: 0x${marker.toString(16)}`);
    }

    const type = reader.readInt32BE();
    if (type !== 0 && type !== 1) {
      throw new Error(`Unsupported extmark undo object type: ${type}`);
    }
    extmarks.push({ type, data: reader.readBuffer(EXTMARK_STRUCT_SIZE) });
  }
}

function readHeader(reader: BinaryReader): UndoHeader {
  const nextSeq = reader.readInt32BE();
  const prevSeq = reader.readInt32BE();
  const altNextSeq = reader.readInt32BE();
  const altPrevSeq = reader.readInt32BE();
  const seq = reader.readInt32BE();
  const cursor = readPos(reader);
  const cursorVcol = reader.readInt32BE();
  const flags = reader.readUInt16BE();
  const namedMarks = Array.from({ length: NMARKS }, () => readPos(reader));
  const visual = readVisual(reader);
  const time = reader.readBigUInt64BE();
  const optionalFields = readOptionalFields(reader);
  const entries = readEntries(reader);
  const extmarks = readExtmarks(reader);

  return {
    nextSeq,
    prevSeq,
    altNextSeq,
    altPrevSeq,
    seq,
    cursor,
    cursorVcol,
    flags,
    namedMarks,
    visual,
    time,
    optionalFields,
    entries,
    extmarks,
  };
}

export function parseUndofile(buffer: Buffer): UndoFile {
  const reader = new BinaryReader(buffer);
  const magic = reader.readBuffer(MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error("Not a Neovim undofile.");
  }

  const version = reader.readUInt16BE();
  if (version !== VERSION) {
    throw new Error(`Unsupported Neovim undofile version: ${version}`);
  }

  const hash = reader.readBuffer(32);
  const lineCount = reader.readInt32BE();
  const uLineLength = reader.readInt32BE();
  if (uLineLength < 0) {
    throw new Error(`Invalid U-line length: ${uLineLength}`);
  }
  const uLine = reader.readBuffer(uLineLength);
  const uLineLnum = reader.readInt32BE();
  const uLineColnr = reader.readInt32BE();
  const oldHeadSeq = reader.readInt32BE();
  const newHeadSeq = reader.readInt32BE();
  const curHeadSeq = reader.readInt32BE();
  const numHead = reader.readInt32BE();
  const seqLast = reader.readInt32BE();
  const seqCur = reader.readInt32BE();
  const timeCur = reader.readBigUInt64BE();
  const optionalFields = readOptionalFields(reader);

  const headers: UndoHeader[] = [];
  while (true) {
    const marker = reader.readUInt16BE();
    if (marker === UF_HEADER_END_MAGIC) break;
    if (marker !== UF_HEADER_MAGIC) {
      throw new Error(`Invalid undo header marker: 0x${marker.toString(16)}`);
    }
    headers.push(readHeader(reader));
  }

  if (!reader.eof) {
    throw new Error("Trailing data after undofile end marker.");
  }
  if (headers.length !== numHead) {
    throw new Error(
      `Header count mismatch: expected ${numHead}, read ${headers.length}.`,
    );
  }

  return {
    hash,
    lineCount,
    uLine,
    uLineLnum,
    uLineColnr,
    oldHeadSeq,
    newHeadSeq,
    curHeadSeq,
    seqLast,
    seqCur,
    timeCur,
    optionalFields,
    headers,
  };
}

export const UND_FILE_CONSTANTS = {
  MAGIC,
  VERSION,
  UF_HEADER_MAGIC,
  UF_HEADER_END_MAGIC,
  UF_ENTRY_MAGIC,
  UF_ENTRY_END_MAGIC,
  NMARKS,
} as const;
