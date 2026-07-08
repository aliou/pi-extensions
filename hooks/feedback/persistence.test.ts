import { describe, expect, it } from "vitest";
import {
  buildClearRecord,
  buildFeedbackRecord,
  normalizeComment,
} from "./persistence";
import type { FeedbackRating } from "./types";

const item = {
  targetEntryId: "entry-1",
  subagentName: "advisor",
  sessionId: "sib-1",
};

describe("normalizeComment", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeComment(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeComment("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only input", () => {
    expect(normalizeComment("   \t\n  ")).toBeUndefined();
  });

  it("trims non-empty comments", () => {
    expect(normalizeComment("  helpful  ")).toBe("helpful");
  });

  it("preserves internal whitespace", () => {
    expect(normalizeComment("  very helpful indeed  ")).toBe(
      "very helpful indeed",
    );
  });
});

describe("buildFeedbackRecord", () => {
  it("builds a record without a comment field when comment is omitted", () => {
    const record = buildFeedbackRecord(item, "good");
    expect(record).toEqual({
      targetEntryId: "entry-1",
      subagentName: "advisor",
      sessionId: "sib-1",
      rating: "good",
    });
    expect(record).not.toHaveProperty("comment");
  });

  it("omits the comment field when comment is whitespace-only", () => {
    const record = buildFeedbackRecord(item, "ok" as FeedbackRating, "   ");
    expect(record).not.toHaveProperty("comment");
  });

  it("trims and includes the comment when non-empty", () => {
    const record = buildFeedbackRecord(item, "bad", "  too slow  ");
    expect(record.comment).toBe("too slow");
  });

  it("preserves each rating value", () => {
    for (const rating of ["good", "ok", "bad"] as const) {
      expect(buildFeedbackRecord(item, rating).rating).toBe(rating);
    }
  });
});

describe("buildClearRecord", () => {
  it("builds a record without a rating field", () => {
    const record = buildClearRecord(item);
    expect(record).toEqual({
      targetEntryId: "entry-1",
      subagentName: "advisor",
      sessionId: "sib-1",
    });
    expect(record).not.toHaveProperty("rating");
  });
});
