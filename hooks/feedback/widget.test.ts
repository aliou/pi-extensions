import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { NOOP_THEME } from "@harness/test-utils/theme";
import { describe, expect, it, vi } from "vitest";
import type { FeedbackSnapshot } from "./types";
import {
  clearFeedbackWidget,
  FEEDBACK_WIDGET_ID,
  renderFeedbackLine,
  setFeedbackWidget,
} from "./widget";

const snapshot = (
  overrides: Partial<FeedbackSnapshot> = {},
): FeedbackSnapshot => ({
  items: [],
  total: 0,
  unrated: 0,
  rated: 0,
  ...overrides,
});

const makeCtx = (hasUI = true) =>
  ({
    hasUI,
    ui: { setWidget: vi.fn() },
  }) as unknown as ExtensionContext;

describe("renderFeedbackLine", () => {
  it("renders `feedback: <unrated>/<total>`", () => {
    const line = renderFeedbackLine(
      snapshot({ unrated: 2, total: 5 }),
      60,
      NOOP_THEME,
    );
    expect(line).toHaveLength(1);
    expect(line[0]?.trim()).toBe("feedback: 2/5");
  });

  it("right-aligns the label within the given width", () => {
    const width = 60;
    const lines = renderFeedbackLine(
      snapshot({ unrated: 2, total: 5 }),
      width,
      NOOP_THEME,
    );
    const line = lines[0] ?? "";
    expect(line.length).toBe(width);
    expect(line.startsWith("feedback: 2/5")).toBe(false);
    expect(line.endsWith("feedback: 2/5")).toBe(true);
  });

  it("does not exceed the width when the label is longer than width", () => {
    const lines = renderFeedbackLine(
      snapshot({ unrated: 10, total: 99 }),
      4,
      NOOP_THEME,
    );
    expect(lines).toHaveLength(1);
    expect(visibleWidth(lines[0] ?? "")).toBeLessThanOrEqual(4);
  });
});

describe("setFeedbackWidget", () => {
  it("sets a widget factory when there are unrated calls", () => {
    const ctx = makeCtx();
    setFeedbackWidget(ctx, snapshot({ unrated: 1, total: 3 }));

    expect(ctx.ui.setWidget).toHaveBeenCalledTimes(1);
    const call =
      (ctx.ui.setWidget as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    const [key, content] = call;
    expect(key).toBe(FEEDBACK_WIDGET_ID);
    expect(typeof content).toBe("function");

    // The factory returns a renderable component.
    const component = (content as (tui: unknown, theme: unknown) => unknown)(
      {},
      NOOP_THEME,
    ) as {
      render: (w: number) => string[];
      invalidate: () => void;
    };
    expect(component.render(60)[0]?.trim()).toBe("feedback: 1/3");
  });

  it("clears the widget when there are no subagent runs", () => {
    const ctx = makeCtx();
    setFeedbackWidget(ctx, snapshot());
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      FEEDBACK_WIDGET_ID,
      undefined,
    );
  });

  it("clears the widget when everything is rated", () => {
    const ctx = makeCtx();
    setFeedbackWidget(ctx, snapshot({ unrated: 0, total: 3, rated: 3 }));
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      FEEDBACK_WIDGET_ID,
      undefined,
    );
  });

  it("does nothing when there is no UI", () => {
    const ctx = makeCtx(false);
    setFeedbackWidget(ctx, snapshot({ unrated: 1, total: 1 }));
    expect(ctx.ui.setWidget).not.toHaveBeenCalled();
  });
});

describe("clearFeedbackWidget", () => {
  it("clears the widget key", () => {
    const ctx = makeCtx();
    clearFeedbackWidget(ctx);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      FEEDBACK_WIDGET_ID,
      undefined,
    );
  });

  it("is a no-op without UI", () => {
    const ctx = makeCtx(false);
    clearFeedbackWidget(ctx);
    expect(ctx.ui.setWidget).not.toHaveBeenCalled();
  });
});
