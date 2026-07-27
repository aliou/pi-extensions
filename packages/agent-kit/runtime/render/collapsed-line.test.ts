import type { Component } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import { assert, describe, expect, it, vi } from "vitest";
import { CollapsedLine } from "./collapsed-line";

function component(lines: string[], invalidate = vi.fn()): Component {
  return {
    render: () => lines,
    invalidate,
  };
}

describe("CollapsedLine", () => {
  it("flattens rendered content to one line", () => {
    const rendered = new CollapsedLine(
      component(["first line   ", "", "second line   "]),
    ).render(80);

    expect(rendered).toEqual(["first line second line"]);
  });

  it("truncates the line to the available width", () => {
    const [line] = new CollapsedLine(
      component(["first part", "second part"]),
    ).render(12);

    assert(line);
    expect(line).toContain("…");
    expect(visibleWidth(line)).toBe(12);
  });

  it("handles ANSI styling and styled padding", () => {
    const red = "\u001b[31mred\u001b[0m";
    const blank = "\u001b[41m    \u001b[0m";
    const [line] = new CollapsedLine(
      component([`${red}   `, blank, "blue"]),
    ).render(8);

    assert(line);
    expect(visibleWidth(line)).toBeLessThanOrEqual(8);
    expect(line).toContain("red");
    expect(line).toContain("blue");
  });

  it("delegates invalidation", () => {
    const invalidate = vi.fn();
    const line = new CollapsedLine(component(["content"], invalidate));

    line.invalidate();

    expect(invalidate).toHaveBeenCalledOnce();
  });
});
