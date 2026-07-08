import type {
  CustomEntry,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type {
  SubagentResolvedModel,
  SubagentSessionRecord,
} from "@harness/agent-kit";
import { describe, expect, it } from "vitest";
import { collectFeedback, sortFeedbackItems } from "./collect";
import {
  type FeedbackItem,
  type FeedbackRating,
  SUBAGENT_FEEDBACK_CUSTOM_TYPE,
  type SubagentFeedbackRecord,
} from "./types";

const CURRENT_SESSION = "session-current";
const OTHER_SESSION = "session-old";

const ts = (id: string): string => {
  const seconds = Number(id) % 1000;
  return `2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`;
};

const model: SubagentResolvedModel = {
  provider: "anthropic",
  model: "claude-sonnet",
  thinking: "low",
};

function subagentEntry(
  id: string,
  parentId: string | null,
  overrides: Partial<SubagentSessionRecord> = {},
): CustomEntry<SubagentSessionRecord> {
  const name = overrides.name ?? "advisor";
  return {
    id,
    parentId,
    timestamp: ts(id),
    type: "custom",
    customType: "subagent_session",
    data: {
      type: "subagent_session",
      name,
      sessionId: `sib-${id}`,
      sessionFile: `/sessions/sib-${id}.jsonl`,
      parentSessionId: CURRENT_SESSION,
      model,
      ...overrides,
    },
  };
}

function feedbackEntry(
  id: string,
  parentId: string,
  targetEntryId: string,
  rating?: FeedbackRating,
  overrides: Partial<SubagentFeedbackRecord> = {},
): CustomEntry<SubagentFeedbackRecord> {
  return {
    id,
    parentId,
    timestamp: ts(id),
    type: "custom",
    customType: SUBAGENT_FEEDBACK_CUSTOM_TYPE,
    data: {
      targetEntryId,
      subagentName: overrides.subagentName ?? "advisor",
      sessionId: overrides.sessionId ?? `sib-${targetEntryId}`,
      ...(rating ? { rating } : {}),
      ...overrides,
    },
  };
}

function message(id: string, parentId: string | null): SessionEntry {
  return {
    id,
    parentId,
    timestamp: ts(id),
    type: "message",
    message: { role: "user", content: [], timestamp: 0 },
  };
}

describe("collectFeedback", () => {
  it("returns an empty snapshot when there are no subagent sessions", () => {
    const snapshot = collectFeedback([message("1", null)], {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.total).toBe(0);
    expect(snapshot.unrated).toBe(0);
    expect(snapshot.items).toEqual([]);
  });

  it("counts one unrated subagent call", () => {
    const entries = [message("1", null), subagentEntry("2", "1")];
    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot).toMatchObject({ total: 1, unrated: 1, rated: 0 });
    expect(snapshot.items[0]).toMatchObject({
      subagentName: "advisor",
      rating: undefined,
      modelLabel: "anthropic/claude-sonnet",
    });
  });

  it("matches feedback to a subagent call by targetEntryId", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      feedbackEntry("3", "2", "2", "good"),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot).toMatchObject({ total: 1, unrated: 0, rated: 1 });
    expect(snapshot.items[0]?.rating).toBe("good");
    expect(snapshot.items[0]?.comment).toBeUndefined();
  });

  it("uses the latest feedback when a call is rated twice (last-write-wins)", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      feedbackEntry("3", "2", "2", "bad"),
      feedbackEntry("4", "3", "2", "good"),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.unrated).toBe(0);
    expect(snapshot.items[0]?.rating).toBe("good");
    expect(snapshot.items[0]?.feedbackEntryId).toBe("4");
  });

  it("ignores feedback whose sessionId does not match the subagent call", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      feedbackEntry("3", "2", "2", "bad", { sessionId: "some-other-session" }),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.unrated).toBe(1);
    expect(snapshot.items[0]?.rating).toBeUndefined();
  });

  it("ignores feedback whose targetEntryId is not in this branch", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      // Targets an entry that will not be on the leaf's branch.
      feedbackEntry("3", "2", "missing-target", "ok"),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.unrated).toBe(1);
    expect(snapshot.items[0]?.rating).toBeUndefined();
  });

  it("filters out subagent records from a different (forked parent) session", () => {
    const entries = [
      message("1", null),
      // Inherited from the source session.
      subagentEntry("2", "1", { parentSessionId: OTHER_SESSION }),
      // New in the current fork.
      subagentEntry("3", "1", { name: "scout" }),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.total).toBe(1);
    expect(snapshot.items[0]?.subagentName).toBe("scout");
  });

  it("follows the active branch when a leafId is provided", () => {
    // Branch: 1 -> 2 (subagent) ; separate branch: 1 -> 4 (subagent)
    const entries: SessionEntry[] = [
      message("1", null),
      subagentEntry("2", "1"),
      // Fork from root taking a different subagent call.
      subagentEntry("4", "1", { name: "oracle" }),
    ];

    const fromLeaf2 = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
      leafId: "2",
    });
    const fromLeaf4 = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
      leafId: "4",
    });

    expect(fromLeaf2.items[0]?.subagentName).toBe("advisor");
    expect(fromLeaf4.items[0]?.subagentName).toBe("oracle");
  });

  it("preserves comments on matched feedback", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      feedbackEntry("3", "2", "2", "ok", { comment: "  helpful  " }),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.items[0]?.comment).toBe("  helpful  ");
  });

  it("ignores malformed feedback records", () => {
    const entries: SessionEntry[] = [
      message("1", null),
      subagentEntry("2", "1"),
      {
        id: "3",
        parentId: "2",
        timestamp: ts("3"),
        type: "custom",
        customType: SUBAGENT_FEEDBACK_CUSTOM_TYPE,
        // Invalid: bad rating value + missing targetEntryId.
        data: { rating: "excellent" },
      },
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.unrated).toBe(1);
  });

  it("treats a feedback entry without a rating as a clear (unrated)", () => {
    const entries = [
      message("1", null),
      subagentEntry("2", "1"),
      feedbackEntry("3", "2", "2", "good"),
      // A later no-rating entry clears the good rating.
      feedbackEntry("4", "3", "2", undefined),
    ];

    const snapshot = collectFeedback(entries, {
      currentSessionId: CURRENT_SESSION,
    });

    expect(snapshot.rated).toBe(0);
    expect(snapshot.unrated).toBe(1);
    expect(snapshot.items[0]?.rating).toBeUndefined();
  });
});

describe("sortFeedbackItems", () => {
  const items = (
    overrides: Array<
      Partial<FeedbackItem> & Pick<FeedbackItem, "subagentName">
    >,
  ): FeedbackItem[] =>
    overrides.map((override, index) => ({
      targetEntryId: `t-${index}`,
      sessionId: `s-${index}`,
      sessionFile: "",
      modelLabel: "-",
      timestamp: ts(String(index + 10)),
      timestampMs: Date.parse(ts(String(index + 10))) || 0,
      ...override,
    }));

  it("puts unrated items first, then by most recent", () => {
    const input = items([
      { subagentName: "a", rating: "good" }, // rated, older
      { subagentName: "b" }, // unrated
      { subagentName: "c", rating: "bad" }, // rated
    ]);

    const sorted = sortFeedbackItems(input, "status");

    expect(sorted[0]?.subagentName).toBe("b");
  });

  it("sorts by most recent first", () => {
    const input = items([{ subagentName: "old" }, { subagentName: "new" }]);

    const sorted = sortFeedbackItems(input, "recent");

    expect(sorted[0]?.subagentName).toBe("new");
  });

  it("sorts by name, falling back to most recent", () => {
    const input = items([{ subagentName: "zeta" }, { subagentName: "alpha" }]);

    const sorted = sortFeedbackItems(input, "name");

    expect(sorted[0]?.subagentName).toBe("alpha");
  });

  it("does not mutate the input array", () => {
    const input = items([{ subagentName: "b" }, { subagentName: "a" }]);

    sortFeedbackItems(input, "name");

    expect(input[0]?.subagentName).toBe("b");
  });
});
