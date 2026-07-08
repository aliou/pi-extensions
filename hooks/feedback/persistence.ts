import type { FeedbackRating, SubagentFeedbackRecord } from "./types";

/**
 * Trim a raw comment string. Returns undefined for empty/whitespace-only input
 * so the persisted record omits the field entirely.
 */
export function normalizeComment(
  comment: string | undefined,
): string | undefined {
  if (!comment) return undefined;
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Build a clear record that resets the target to unrated (last-write-wins). */
export function buildClearRecord(item: {
  targetEntryId: string;
  subagentName: string;
  sessionId: string;
}): SubagentFeedbackRecord {
  return {
    targetEntryId: item.targetEntryId,
    subagentName: item.subagentName,
    sessionId: item.sessionId,
  };
}

/** Build the record shape persisted in the `subagent_feedback` custom entry. */
export function buildFeedbackRecord(
  item: { targetEntryId: string; subagentName: string; sessionId: string },
  rating: FeedbackRating,
  comment?: string,
): SubagentFeedbackRecord {
  const normalized = normalizeComment(comment);
  return {
    targetEntryId: item.targetEntryId,
    subagentName: item.subagentName,
    sessionId: item.sessionId,
    rating,
    ...(normalized ? { comment: normalized } : {}),
  };
}
