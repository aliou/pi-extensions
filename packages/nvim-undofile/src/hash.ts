import { createHash } from "node:crypto";

export function contentToUndoLines(content: string): Buffer[] {
  if (content.includes("\0")) {
    throw new Error(
      "NUL bytes are not supported in Neovim undofile text lines.",
    );
  }

  if (content.length === 0) {
    return [Buffer.alloc(0)];
  }

  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutFinalEol = normalized.endsWith("\n")
    ? normalized.slice(0, -1)
    : normalized;

  if (withoutFinalEol.length === 0) {
    return [Buffer.alloc(0)];
  }

  return withoutFinalEol.split("\n").map((line) => Buffer.from(line, "utf8"));
}

export function computeUndoHash(content: string): Buffer {
  const hash = createHash("sha256");

  for (const line of contentToUndoLines(content)) {
    hash.update(line);
    hash.update(Buffer.from([0]));
  }

  return hash.digest();
}

export function undoLineCount(content: string): number {
  return contentToUndoLines(content).length;
}
