import type {
  CustomEntry,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  SUBAGENT_SESSION_CUSTOM_TYPE,
  type SubagentSessionRecord,
} from "@harness/agent-kit";
import { createSessionView } from "@harness/session-tools";
import {
  type FeedbackItem,
  type FeedbackRating,
  type FeedbackSnapshot,
  type FeedbackSortMode,
  formatModelLabel,
  SUBAGENT_FEEDBACK_CUSTOM_TYPE,
  type SubagentFeedbackRecord,
} from "./types";

export interface CollectOptions {
  /** Id of the session doing the collecting. Forks filter by this. */
  currentSessionId: string;
  /** Leaf entry id to resolve the branch from. Defaults to the main leaf. */
  leafId?: string;
}

/**
 * Collect subagent calls for the current branch and match each to its latest
 * feedback rating (last-write-wins root -> leaf).
 *
 * Fork behavior: only `subagent_session` entries whose `parentSessionId`
 * matches `currentSessionId` are counted. Inherited parent-branch copies are
 * ignored so a fork starts with a fresh rating surface.
 *
 * Feedback entries are only applied when their `targetEntryId` matches one of
 * the collected subagent entries AND the `sessionId` lines up. Stale feedback
 * from a different branch is silently ignored.
 */
export function collectFeedback(
  entries: SessionEntry[],
  options: CollectOptions,
): FeedbackSnapshot {
  const view = createSessionView(entries);
  // getBranch() returns leaf -> root; reverse for root -> leaf so the
  // leaf-most (latest) feedback overwrites earlier ones in the map.
  const branch = [...view.getBranch(options.leafId)].reverse();

  const subagentEntries: CustomEntry<SubagentSessionRecord>[] = [];
  const latestFeedbackByTarget = new Map<
    string,
    CustomEntry<SubagentFeedbackRecord>
  >();

  for (const entry of branch) {
    if (isSubagentSessionEntry(entry)) {
      // Fork filter: only count subagent runs that happened in this session.
      if (entry.data?.parentSessionId !== options.currentSessionId) continue;
      subagentEntries.push(entry);
      continue;
    }

    if (isFeedbackEntry(entry)) {
      const record = entry.data;
      if (!record) continue;
      // Only remember the latest. Target validity is checked at match time.
      latestFeedbackByTarget.set(record.targetEntryId, entry);
    }
  }

  const items: FeedbackItem[] = subagentEntries.map((entry) => {
    const record = entry.data as SubagentSessionRecord | undefined;
    const feedback =
      record && latestFeedbackByTarget.has(entry.id)
        ? latestFeedbackByTarget.get(entry.id)
        : undefined;

    const feedbackRecord = feedback?.data;
    const sessionIdMatches =
      feedbackRecord && record && feedbackRecord.sessionId === record.sessionId;
    const rating = sessionIdMatches ? feedbackRecord?.rating : undefined;

    return {
      targetEntryId: entry.id,
      subagentName: record?.name ?? "unknown",
      sessionId: record?.sessionId ?? "",
      sessionFile: record?.sessionFile ?? "",
      modelLabel: formatModelLabel(record?.model),
      timestamp: entry.timestamp,
      timestampMs: Date.parse(entry.timestamp) || 0,
      rating,
      comment: sessionIdMatches ? feedbackRecord?.comment : undefined,
      feedbackEntryId: sessionIdMatches ? feedback?.id : undefined,
    };
  });

  const rated = items.filter((item) => item.rating !== undefined).length;
  const total = items.length;

  return { items, total, unrated: total - rated, rated };
}

/**
 * Sort a snapshot's items by the given mode without mutating the input.
 *
 * - `status`: unrated first, then newest first.
 * - `recent`: newest first.
 * - `name`: subagentName asc, then newest first.
 */
export function sortFeedbackItems(
  items: FeedbackItem[],
  mode: FeedbackSortMode,
): FeedbackItem[] {
  const byRecent = (a: FeedbackItem, b: FeedbackItem) =>
    b.timestampMs - a.timestampMs;

  switch (mode) {
    case "recent":
      return [...items].sort(byRecent);
    case "name":
      return [...items].sort((a, b) => {
        const cmp = a.subagentName.localeCompare(b.subagentName);
        return cmp !== 0 ? cmp : byRecent(a, b);
      });
    case "status":
      return [...items].sort((a, b) => {
        const aUnrated = a.rating === undefined ? 0 : 1;
        const bUnrated = b.rating === undefined ? 0 : 1;
        if (aUnrated !== bUnrated) return aUnrated - bUnrated;
        return byRecent(a, b);
      });
    default:
      return [...items];
  }
}

export function isSubagentSessionEntry(
  entry: SessionEntry,
): entry is CustomEntry<SubagentSessionRecord> {
  return (
    entry.type === "custom" &&
    entry.customType === SUBAGENT_SESSION_CUSTOM_TYPE &&
    isSubagentSessionData(entry.data)
  );
}

export function isFeedbackEntry(
  entry: SessionEntry,
): entry is CustomEntry<SubagentFeedbackRecord> {
  return (
    entry.type === "custom" &&
    entry.customType === SUBAGENT_FEEDBACK_CUSTOM_TYPE &&
    isFeedbackData(entry.data)
  );
}

function isSubagentSessionData(data: unknown): data is SubagentSessionRecord {
  if (data === null || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    record.type === SUBAGENT_SESSION_CUSTOM_TYPE &&
    typeof record.name === "string" &&
    typeof record.sessionId === "string" &&
    typeof record.sessionFile === "string" &&
    typeof record.parentSessionId === "string"
  );
}

function isFeedbackData(data: unknown): data is SubagentFeedbackRecord {
  if (data === null || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.targetEntryId === "string" &&
    typeof record.subagentName === "string" &&
    typeof record.sessionId === "string" &&
    (record.rating === undefined || isFeedbackRating(record.rating))
  );
}

function isFeedbackRating(value: unknown): value is FeedbackRating {
  return value === "good" || value === "ok" || value === "bad";
}
