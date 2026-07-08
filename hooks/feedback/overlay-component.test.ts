import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { NOOP_THEME } from "@harness/test-utils/theme";
import { describe, expect, it, vi } from "vitest";
import { FeedbackOverlayComponent } from "./overlay-component";
import type { FeedbackItem, FeedbackRating, FeedbackSnapshot } from "./types";

const ESC = "\x1b";
const ENTER = "\r";

const fakeTui = (): TUI =>
  ({
    requestRender: vi.fn(),
    terminal: { columns: 120, rows: 40 },
  }) as unknown as TUI;

const item = (
  name: string,
  sessionId: string,
  rating?: FeedbackRating,
): FeedbackItem => ({
  targetEntryId: `entry-${sessionId}`,
  subagentName: name,
  sessionId,
  sessionFile: `/sessions/${sessionId}.jsonl`,
  modelLabel: "anthropic/claude",
  timestamp: new Date(Date.now() - 60_000).toISOString(),
  timestampMs: Date.now() - 60_000,
  rating,
});

const snapshot = (items: FeedbackItem[]): FeedbackSnapshot => ({
  items,
  total: items.length,
  unrated: items.filter((i) => !i.rating).length,
  rated: items.filter((i) => i.rating).length,
});

const makeOverlay = (opts: {
  snapshot: FeedbackSnapshot;
  readTranscript?:
    | ((item: { sessionId: string }) =>
        | {
            input?: string;
            output?: string;
            toolResult?: string;
            outputTokens?: number;
          }
        | undefined)
    | undefined;
  onSubmit?: (
    item: FeedbackItem,
    rating: FeedbackRating | undefined,
    comment?: string,
  ) => void;
}) =>
  new FeedbackOverlayComponent({
    snapshot: opts.snapshot,
    tui: fakeTui(),
    theme: NOOP_THEME as Theme,
    readTranscript:
      opts.readTranscript ??
      ((i) => ({ input: `prompt ${i.sessionId}`, output: "response" })),
    onSubmit: opts.onSubmit ?? (() => {}),
    onClose: () => {},
  });

describe("FeedbackOverlayComponent", () => {
  it("renders a list of items with their names", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("advisor", "s1"), item("oracle", "s2")]),
    });

    const text = overlay.render(100).join("\n");
    expect(text).toContain("advisor");
    expect(text).toContain("oracle");
    expect(text).toContain("feedback 2/2");
  });

  it("renders an empty-state message when there are no items", () => {
    const overlay = makeOverlay({ snapshot: snapshot([]) });
    expect(overlay.render(80).join("\n")).toContain("No subagent runs");
  });

  it("navigates the list with j/k", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2"), item("c", "s3")]),
    });

    overlay.handleInput("j");
    overlay.handleInput("j");
    overlay.handleInput(ENTER);
    expect(overlay.render(100).join("\n")).toContain("prompt s3");
  });

  it("does not navigate past the bounds", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2")]),
    });

    overlay.handleInput("j");
    overlay.handleInput("j");
    overlay.handleInput("j");
    overlay.handleInput(ENTER);
    expect(overlay.render(100).join("\n")).toContain("prompt s2");
  });

  it("open -> esc returns to the list; second esc closes", () => {
    const closed = vi.fn();
    const overlay = new FeedbackOverlayComponent({
      snapshot: snapshot([item("a", "s1")]),
      tui: fakeTui(),
      theme: NOOP_THEME as Theme,
      readTranscript: () => ({ input: "q", output: "answer" }),
      onSubmit: () => {},
      onClose: closed,
    });

    overlay.handleInput(ENTER);
    overlay.handleInput(ESC); // back to list
    overlay.handleInput(ESC); // close
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("pressing 1/2/3 opens comment mode then enter submits the rating", () => {
    const submitted: Array<{
      rating: FeedbackRating | undefined;
      comment?: string;
    }> = [];
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      onSubmit: (_i, rating, comment) => submitted.push({ rating, comment }),
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("3"); // good
    overlay.handleInput("n");
    overlay.handleInput("i");
    overlay.handleInput("c");
    overlay.handleInput("e");
    overlay.handleInput(ENTER);

    expect(submitted).toEqual([{ rating: "good", comment: "nice" }]);
    expect(overlay.render(100).join("\n")).toContain("feedback: detail");
  });

  it("enter with empty comment submits with no comment field", () => {
    const submitted: Array<{
      rating: FeedbackRating | undefined;
      comment?: string;
    }> = [];
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      onSubmit: (_i, rating, comment) => submitted.push({ rating, comment }),
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("2"); // ok
    overlay.handleInput(ENTER); // empty comment

    expect(submitted).toEqual([{ rating: "ok" }]);
  });

  it("esc in comment mode cancels and returns to detail (no submit)", () => {
    const submitted: Array<{
      rating: FeedbackRating | undefined;
      comment?: string;
    }> = [];
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      onSubmit: (_i, rating, comment) => submitted.push({ rating, comment }),
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("1"); // bad
    overlay.handleInput(ESC); // cancel -> back to detail

    expect(submitted).toEqual([]);
    expect(overlay.render(100).join("\n")).toContain("feedback: detail");
  });

  it("after submitting a rating the item shows it in the detail view", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      onSubmit: () => {},
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("2"); // ok
    overlay.handleInput(ENTER); // empty comment

    expect(overlay.render(100).join("\n")).toContain("okay");
  });

  it("shows the stored comment in detail after rating", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      onSubmit: () => {},
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("2"); // ok
    overlay.handleInput("c");
    overlay.handleInput("o");
    overlay.handleInput("o");
    overlay.handleInput("l");
    overlay.handleInput(ENTER);

    const text = overlay.render(100).join("\n");
    expect(text).toContain("comment:");
    expect(text).toContain("cool");
  });

  it("c in detail view clears the rating", () => {
    const submitted: Array<{ rating: FeedbackRating | undefined }> = [];
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1", "good")]),
      onSubmit: (_i, rating) => submitted.push({ rating }),
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("c"); // clear

    expect(submitted).toEqual([{ rating: undefined }]);
    expect(overlay.render(100).join("\n")).toContain("rated: —");
  });

  it("shows Transcript unavailable when readTranscript returns undefined", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      readTranscript: () => undefined,
    });

    overlay.handleInput(ENTER);
    expect(overlay.render(100).join("\n")).toContain("Transcript unavailable");
  });

  it("shows session_name tool result as the primary output", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("session_name", "s1")]),
      readTranscript: () => ({
        input: "long user prompt here",
        output: "ok",
        toolResult: "my generated name",
      }),
    });

    overlay.handleInput(ENTER);
    const text = overlay.render(100).join("\n");
    expect(text).toContain("my generated name");
  });

  it("renders stats in the detail view", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1")]),
      readTranscript: () => ({
        input: "q",
        output: "a",
        inputTokens: 1234,
        outputTokens: 567,
        cost: 0.0042,
        toolCalls: 2,
        durationMs: 3500,
      }),
    });

    overlay.handleInput(ENTER);
    const text = overlay.render(100).join("\n");
    expect(text).toContain("1234/567 tokens");
    expect(text).toContain("2 tool calls");
    expect(text).toContain("$0.0042");
    expect(text).toContain("3s");
  });

  it("preserves ratings across a re-sort (no score loss)", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2")]),
      onSubmit: () => {},
    });

    overlay.handleInput(ENTER);
    overlay.handleInput("3"); // good
    overlay.handleInput(ENTER); // empty comment
    overlay.handleInput(ESC); // back to list

    overlay.handleInput("s"); // cycle sort
    overlay.handleInput("s");
    overlay.handleInput("s");

    expect(overlay.render(100).join("\n")).toContain("good");
  });

  it("cycles sort mode with `s`", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("zeta", "s1"), item("alpha", "s2")]),
    });

    overlay.render(80);
    overlay.handleInput("s");
    expect(overlay.render(100).join("\n")).toContain("sort:recent");
    overlay.handleInput("s");
    expect(overlay.render(100).join("\n")).toContain("sort:name");
    overlay.handleInput("s");
    expect(overlay.render(100).join("\n")).toContain("sort:status");
  });

  it("list navigation loops with j/k (wrap-around)", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2")]),
    });

    overlay.handleInput("k"); // wrap to last
    overlay.handleInput(ENTER);
    expect(overlay.render(100).join("\n")).toContain("prompt s2");
  });

  it("navigates between subagent sessions in detail with h/l", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2")]),
    });

    overlay.handleInput(ENTER); // open detail on s1
    overlay.handleInput("l"); // next session
    expect(overlay.render(100).join("\n")).toContain("prompt s2");
    overlay.handleInput("h"); // previous session
    expect(overlay.render(100).join("\n")).toContain("prompt s1");
  });

  it("renders without exceeding the requested width", () => {
    const overlay = makeOverlay({
      snapshot: snapshot([item("a", "s1"), item("b", "s2")]),
    });

    const width = 70;
    for (const line of overlay.render(width)) {
      expect(line.length).toBeLessThanOrEqual(width + 20);
    }
  });
});
