import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { beforeAll, describe, expect, it } from "vitest";
import { formatDiffResultText, summarizeDiff } from "./render";

const plainTheme = {
  fg: (_name: string, text: string) => text,
  bg: (_name: string, text: string) => text,
  bold: (text: string) => text,
  inverse: (text: string) => text,
} as Theme;

describe("edit result rendering", () => {
  const diff = Array.from({ length: 12 }, (_, index) => ` ${index + 1} before`)
    .concat(["-13 old line", "+13 new line"])
    .join("\n");

  beforeAll(() => {
    initTheme("dark", false);
  });

  it("summarizes diff stats", () => {
    expect(summarizeDiff(diff)).toEqual({ additions: 1, removals: 1 });
  });

  it("truncates diff body when collapsed", () => {
    const collapsed = formatDiffResultText(diff, false, plainTheme);

    expect(collapsed).toContain("1 before");
    expect(collapsed).toContain("10 before");
    expect(collapsed).toContain("more lines");
    expect(collapsed).not.toContain("old line");
    expect(collapsed).not.toContain("new line");
  });

  it("shows diff body when expanded", () => {
    const expanded = formatDiffResultText(diff, true, plainTheme);

    expect(expanded).toContain("1 before");
    expect(expanded).toContain("old line");
    expect(expanded).toContain("new line");
    expect(expanded).not.toContain("more lines");
  });
});
