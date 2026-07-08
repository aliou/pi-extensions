import type { SubagentResolvedModel } from "@harness/agent-kit";

/**
 * Custom entry type written by the feedback extension.
 *
 * Stored as a `custom` entry (NOT `custom_message`), so ratings never enter
 * LLM context. Re-rating appends a new entry; last-write-wins by branch order
 * (see collect.ts).
 */
export const SUBAGENT_FEEDBACK_CUSTOM_TYPE = "subagent_feedback" as const;

export type FeedbackRating = "good" | "ok" | "bad";

/** Sort modes cycled by the `s` key in the overlay list view. */
export type FeedbackSortMode = "status" | "recent" | "name";

/** Ordered ratings for the detail-view rating bar (1=`bad` ... 3=`good`). */
export const RATING_ORDER: readonly FeedbackRating[] = ["bad", "ok", "good"];

/** Human label for each rating. */
export const RATING_LABELS: Record<FeedbackRating, string> = {
  bad: "bad",
  ok: "okay",
  good: "good",
};

/** Shape persisted in the `subagent_feedback` custom entry's `data` field.
 *
 * `rating` is optional so a record with no rating acts as a "clear" (the
 * latest feedback entry wins by branch order, so a no-rating entry resets
 * the item to unrated).
 */
export interface SubagentFeedbackRecord {
  /** Entry id of the `subagent_session` entry this rating targets. */
  targetEntryId: string;
  subagentName: string;
  sessionId: string;
  /** Omit to clear an earlier rating. */
  rating?: FeedbackRating;
  comment?: string;
}

/**
 * A single subagent call resolved against any existing feedback.
 *
 * `feedback` is undefined when the call is unrated. It is the latest rating
 * for this target in the current branch (last-write-wins).
 */
export interface FeedbackItem {
  targetEntryId: string;
  subagentName: string;
  sessionId: string;
  sessionFile: string;
  modelLabel: string;
  timestamp: string;
  timestampMs: number;
  rating?: FeedbackRating;
  comment?: string;
  feedbackEntryId?: string;
  /** Output tokens from the subagent's last assistant message, if known. */
  outputTokens?: number;
}

export interface FeedbackSnapshot {
  items: FeedbackItem[];
  total: number;
  unrated: number;
  rated: number;
}

/** Render a compact, width-friendly label for a resolved subagent model. */
export function formatModelLabel(model?: SubagentResolvedModel): string {
  if (!model) return "-";
  return `${model.provider}/${model.model}`;
}
