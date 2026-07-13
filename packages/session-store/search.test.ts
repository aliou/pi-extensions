import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, sesameSearch } = vi.hoisted(() => ({
  getDb: vi.fn(),
  sesameSearch: vi.fn(),
}));

vi.mock("@aliou/sesame", () => ({
  parseRelativeDate: () => "2026-07-06T00:00:00.000Z",
  search: sesameSearch,
}));

vi.mock("./db", () => ({ getDb }));

import { searchSessions } from "./search";

const db = {
  prepare: vi.fn(() => ({ all: vi.fn(() => []) })),
};

describe("searchSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockReturnValue(db);
    sesameSearch.mockReturnValue([]);
  });

  it("uses Sesame browse mode when the query is omitted", () => {
    searchSessions({});

    expect(sesameSearch).toHaveBeenCalledWith(db, undefined, {
      after: undefined,
      before: undefined,
      cwd: undefined,
      limit: undefined,
    });
  });

  it("preserves Sesame match provenance", () => {
    sesameSearch.mockReturnValue([
      {
        sessionId: "session-id",
        source: "pi",
        path: "/sessions/session.jsonl",
        cwd: "/project",
        name: "Deploy session",
        score: -2,
        createdAt: "2026-07-01T00:00:00.000Z",
        modifiedAt: "2026-07-02T00:00:00.000Z",
        matchedSnippet: "deploy checkpoint",
        matchMode: "all",
        matchedType: "label",
        matchedEntryId: "entry-id",
        matchedAt: "2026-07-01T12:00:00.000Z",
      },
    ]);

    expect(searchSessions({ query: "deploy checkpoint" })).toEqual([
      expect.objectContaining({
        matchMode: "all",
        matchedType: "label",
        matchedEntryId: "entry-id",
        matchedAt: "2026-07-01T12:00:00.000Z",
      }),
    ]);
  });
});
