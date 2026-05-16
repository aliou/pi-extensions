import type { ReviewComment } from "./types";

export function extractComments(annotatedDiff: string): ReviewComment[] {
  const comments: ReviewComment[] = [];
  let currentFile = "";
  let currentLine = 0;

  for (const line of annotatedDiff.split("\n")) {
    const file = parseFileHeader(line);
    if (file) {
      currentFile = file;
      currentLine = 0;
      continue;
    }

    const hunkStart = parseHunkStart(line);
    if (hunkStart) {
      currentLine = hunkStart;
      continue;
    }

    if (isReviewComment(line)) {
      comments.push({
        file: currentFile || "(unknown)",
        line: currentLine,
        comment: line.trim(),
      });
      continue;
    }

    if (currentFile && currentLine > 0 && isNewFileLine(line)) {
      currentLine += 1;
    }
  }

  return comments;
}

function parseFileHeader(line: string): string | null {
  return line.match(/^diff --git a\/(.+?) b\//)?.[1] ?? null;
}

function parseHunkStart(line: string): number | null {
  const match = line.match(/^@@+\s*-\d+(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@+/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function isReviewComment(line: string): boolean {
  return line.trim().length > 0 && !isDiffLine(line);
}

function isDiffLine(line: string): boolean {
  return (
    line.startsWith("diff ") ||
    line.startsWith("index ") ||
    line.startsWith("@@") ||
    line.startsWith("---") ||
    line.startsWith("+++") ||
    line.startsWith("+") ||
    line.startsWith("-") ||
    line.startsWith(" ") ||
    line.startsWith("\\")
  );
}

function isNewFileLine(line: string): boolean {
  return line.startsWith(" ") || line.startsWith("+");
}
