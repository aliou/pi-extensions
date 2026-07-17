import type {
  CustomEntry,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { QqAnswerDetails } from "./types";
import { QQ_ANSWER_TYPE } from "./types";

export function isQqAnswerEntry(
  entry: SessionEntry,
): entry is CustomEntry<QqAnswerDetails> {
  return entry.type === "custom" && entry.customType === QQ_ANSWER_TYPE;
}

/** A group of qq answers sharing one subagent session (one qq thread). */
export interface QqSessionSummary {
  sessionId: string;
  questionCount: number;
  /** First question asked in the thread (for the Display session list). */
  firstQuestion: string;
  /** Most recent question asked in the thread (for the Resume picker). */
  latestQuestion: string;
  /** Timestamp of the first answer. */
  createdAt: number;
  /** Timestamp of the last answer. */
  updatedAt: number;
  model?: QqAnswerDetails["model"];
  /** Answers in chronological order (oldest first). */
  answers: QqAnswerDetails[];
}

/**
 * Group qq answer entries by their subagent session. Each group is one
 * resumable qq thread. Answers without a `subagentSessionId` (legacy entries
 * persisted before threads existed) are each treated as a one-question
 * session keyed by their own `id`. Summaries are returned most-recent first.
 */
export function buildQqSessionSummaries(
  entries: SessionEntry[],
): QqSessionSummary[] {
  const groups = new Map<string, QqAnswerDetails[]>();

  for (const entry of entries) {
    if (!isQqAnswerEntry(entry)) continue;
    const details = entry.data;
    if (!details) continue;
    const key = details.subagentSessionId || details.id;
    const list = groups.get(key);
    if (list) {
      list.push(details);
    } else {
      groups.set(key, [details]);
    }
  }

  const summaries: QqSessionSummary[] = [];
  for (const [sessionId, answers] of groups) {
    // Entries are appended chronologically, so the array is oldest-first.
    const sorted = [...answers].sort((a, b) => a.createdAt - b.createdAt);
    const first = sorted[0];
    const last = sorted.at(-1);
    if (!first || !last) continue;
    summaries.push({
      sessionId,
      questionCount: sorted.length,
      firstQuestion: first.question,
      latestQuestion: last.question,
      createdAt: first.createdAt,
      updatedAt: last.createdAt,
      model: last.model,
      answers: sorted,
    });
  }

  // Most recent first.
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
}
