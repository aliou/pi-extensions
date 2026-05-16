import { existsSync, readFileSync, rmSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { extractComments } from "./comments";
import type { ReviewComment } from "./types";
import { REVIEW_MESSAGE_TYPE } from "./types";

export interface ProcessResult {
  comments: ReviewComment[];
  status: "sent" | "missing-file" | "unchanged" | "no-comments";
}

export function processAnnotatedDiff(
  pi: ExtensionAPI,
  diffFile: string,
  originalContent: string,
  range: string,
): ProcessResult {
  if (!existsSync(diffFile)) return { comments: [], status: "missing-file" };

  const annotatedContent = readFileSync(diffFile, "utf-8");

  if (annotatedContent === originalContent) {
    return { comments: [], status: "unchanged" };
  }

  const comments = extractComments(annotatedContent);
  if (comments.length === 0) return { comments, status: "no-comments" };

  sendReview(pi, comments, range);
  return { comments, status: "sent" };
}

export function appendReviewEntry(
  pi: ExtensionAPI,
  path: string,
  range: string,
  result: ProcessResult,
) {
  pi.appendEntry("review_diff", {
    path,
    range,
    comments: result.comments,
    status: result.status,
  });
}

export function formatReviewContent(comments: ReviewComment[]): string {
  if (comments.length === 0) return "Review completed with no comments.";

  return comments
    .map((comment) => {
      const line = comment.line > 0 ? `:${comment.line}` : "";
      return `${comment.file || "(unknown file)"}${line}: ${comment.comment}`;
    })
    .join("\n");
}

export function removeDir(path: string) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error) {
    void error;
  }
}

function sendReview(
  pi: ExtensionAPI,
  comments: ReviewComment[],
  range: string,
) {
  pi.sendMessage(
    {
      customType: REVIEW_MESSAGE_TYPE,
      content: formatReviewContent(comments),
      display: true,
      details: { comments, range },
    },
    { triggerTurn: true },
  );
}
