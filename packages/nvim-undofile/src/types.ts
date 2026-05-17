export type Pos = {
  lnum: number;
  col: number;
  coladd: number;
};

export type VisualInfo = {
  start: Pos;
  end: Pos;
  mode: number;
  curswant: number;
};

export type OptionalField = {
  what: number;
  data: Buffer;
};

export type UndoEntry = {
  top: number;
  bot: number;
  lcount: number;
  lines: Buffer[];
};

export type ExtmarkRecord = {
  type: number;
  data: Buffer;
};

export type UndoHeader = {
  nextSeq: number;
  prevSeq: number;
  altNextSeq: number;
  altPrevSeq: number;
  seq: number;
  cursor: Pos;
  cursorVcol: number;
  flags: number;
  namedMarks: Pos[];
  visual: VisualInfo;
  time: bigint;
  optionalFields: OptionalField[];
  entries: UndoEntry[];
  extmarks: ExtmarkRecord[];
};

export type UndoFile = {
  hash: Buffer;
  lineCount: number;
  uLine: Buffer;
  uLineLnum: number;
  uLineColnr: number;
  oldHeadSeq: number;
  newHeadSeq: number;
  curHeadSeq: number;
  seqLast: number;
  seqCur: number;
  timeCur: bigint;
  optionalFields: OptionalField[];
  headers: UndoHeader[];
};

export type UpdateUndofileResult =
  | { ok: true; undoFilePath: string }
  | {
      ok: false;
      undoFilePath?: string;
      reason:
        | "missing"
        | "hash-mismatch"
        | "line-count-mismatch"
        | "unsupported-tree"
        | "parse-error"
        | "roundtrip-mismatch"
        | "write-error"
        | "unsupported-content";
      error?: unknown;
    };
