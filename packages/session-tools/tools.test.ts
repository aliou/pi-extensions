import { assert, describe, expect, it } from "vitest";
import {
  createSessionView,
  findEntries,
  getBranchEntries,
  getCheckpoints,
  getEntriesBetween,
  getTreeOutline,
  readCheckpoint,
  readEntry,
} from "./index";
import type { SessionEntry } from "./types";

const timestampFor = (id: string): string => {
  const seconds = Number(id) % 60;
  return `2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`;
};

const entry = (
  id: string,
  parentId: string | null,
  content: string,
): SessionEntry => ({
  id,
  parentId,
  timestamp: timestampFor(id),
  type: "message",
  message: {
    role: "user",
    content: [{ type: "text", text: content }],
    timestamp: Date.parse(timestampFor(id)),
  },
});

const label = (id: string, targetId: string, text: string): SessionEntry => ({
  id,
  parentId: targetId,
  timestamp: timestampFor(id),
  type: "label",
  targetId,
  label: text,
});

const checkpoint = (
  id: string,
  parentId: string | null,
  summary: string,
): SessionEntry => ({
  id,
  parentId,
  timestamp: timestampFor(id),
  type: "compaction",
  summary,
  firstKeptEntryId: parentId ?? id,
  tokensBefore: 123,
});

const branchingEntries = (): SessionEntry[] => [
  entry("1", null, "root"),
  entry("2", "1", "shared"),
  entry("3", "2", "old side branch"),
  entry("4", "2", "main branch first"),
  entry("5", "4", "main branch last"),
];

describe("createSessionView", () => {
  it("uses the last entry as the main branch leaf", () => {
    const view = createSessionView(branchingEntries());

    expect(view.mainLeafId).toBe("5");
    expect(view.getBranch().map((item) => item.id)).toEqual([
      "5",
      "4",
      "2",
      "1",
    ]);
    expect([...view.getMainBranchIds()]).toEqual(["5", "4", "2", "1"]);
  });

  it("keeps alternate branches addressable by leaf id", () => {
    const view = createSessionView(branchingEntries());

    expect(view.getBranch("3").map((item) => item.id)).toEqual(["3", "2", "1"]);
  });

  it("resolves labels from synthetic label entries", () => {
    const view = createSessionView([
      entry("1", null, "root"),
      entry("2", "1", "target"),
      label("3", "2", "important"),
    ]);

    expect(view.getLabel("2")).toBe("important");
  });
});

describe("getBranchEntries", () => {
  it("defaults to the main branch in root-to-leaf order", () => {
    const view = createSessionView(branchingEntries());
    const result = getBranchEntries(view, {});

    expect(result.entries.map((item) => item.id)).toEqual(["1", "2", "4", "5"]);
    expect(result.entries.map((item) => item.isMainBranch)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("reads alternate branches by leaf id", () => {
    const view = createSessionView(branchingEntries());
    const result = getBranchEntries(view, { leafId: "3" });

    expect(result.entries.map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(result.entries.map((item) => item.isMainBranch)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("caps default output", () => {
    const entries = Array.from({ length: 150 }, (_, index) =>
      entry(
        String(index + 1),
        index === 0 ? null : String(index),
        `entry ${index + 1}`,
      ),
    );
    const result = getBranchEntries(createSessionView(entries), {});

    expect(result.entries).toHaveLength(100);
    expect(result.truncated).toBe(true);
    expect(result.limit).toBe(100);
  });
});

describe("getEntriesBetween", () => {
  it("returns a main branch range by default", () => {
    const view = createSessionView(branchingEntries());
    const result = getEntriesBetween(view, { startId: "2" });

    expect(result.entries.map((item) => item.id)).toEqual(["2", "4", "5"]);
    expect(result.branchLeafId).toBe("5");
  });

  it("throws when start is not on the selected branch", () => {
    const view = createSessionView(branchingEntries());

    expect(() => getEntriesBetween(view, { startId: "3" })).toThrow(
      "Start entry '3' is not on branch '5'",
    );
  });
});

describe("getTreeOutline", () => {
  it("returns a bounded flat tree outline", () => {
    const view = createSessionView(branchingEntries());
    const result = getTreeOutline(view, { limit: 3, maxDepth: 10 });

    expect(result.entries.map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(result.truncated).toBe(true);
    expect(result.entries[1]?.childrenIds).toEqual(["3", "4"]);
  });

  it("can return only the main branch", () => {
    const view = createSessionView(branchingEntries());
    const result = getTreeOutline(view, {
      mainBranchOnly: true,
      fromEnd: true,
    });

    expect(result.entries.map((item) => item.id)).toEqual(["5", "4", "2", "1"]);
  });
});

describe("findEntries", () => {
  it("searches main branch by default", () => {
    const view = createSessionView(branchingEntries());
    const result = findEntries(view, { query: "branch" });

    expect(result.matches.map((item) => item.id)).toEqual(["5", "4"]);
  });

  it("searches the full tree when requested", () => {
    const view = createSessionView(branchingEntries());
    const result = findEntries(view, { query: "side", scope: "full_tree" });

    expect(result.matches.map((item) => item.id)).toEqual(["3"]);
  });
});

describe("readEntry", () => {
  it("truncates large serialized content", () => {
    const view = createSessionView([entry("1", null, "x".repeat(100))]);
    const result = readEntry(view, { id: "1", maxChars: 40 });

    expect(result.entry.contentTruncated).toBe(true);
    expect(result.entry.content).toHaveLength(40);
    expect(result.entry.contentLength).toBeGreaterThan(40);
  });

  it("returns children ids", () => {
    const view = createSessionView(branchingEntries());
    const result = readEntry(view, { id: "2" });

    expect(result.entry.childrenIds).toEqual(["3", "4"]);
  });
});

describe("checkpoints", () => {
  it("includes checkpoint previews on the main branch", () => {
    const view = createSessionView([
      entry("1", null, "root"),
      checkpoint("2", "1", "summary ".repeat(200)),
    ]);
    const result = getCheckpoints(view, {});

    expect(result.checkpoints).toHaveLength(1);
    expect(result.checkpoints[0]?.summaryPreview.length).toBeLessThanOrEqual(
      800,
    );

    const full = readCheckpoint(view, { id: "2" });
    assert(typeof full.checkpoint.summary === "string");
    expect(full.checkpoint.summary.length).toBeGreaterThan(800);
  });
});
