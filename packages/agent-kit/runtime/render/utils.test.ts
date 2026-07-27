import { describe, expect, it } from "vitest";
import {
  isScaffoldingParagraph,
  selectCollapsedPreview,
  splitParagraphs,
} from "./utils";

// A substance paragraph is long enough (>120 chars) to not count as
// scaffolding. Reused across tests.
const SUBSTANCE =
  "This is a substantive paragraph that is long enough to exceed the scaffolding threshold so it is treated as real content and counts against the preview budget.";

describe("splitParagraphs", () => {
  it("splits on blank lines and drops empty entries", () => {
    expect(splitParagraphs("a\n\nb\n\n\n  \n\nc")).toEqual(["a", "b", "c"]);
  });

  it("trims and returns an empty array for blank input", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("isScaffoldingParagraph", () => {
  it("treats standalone headings as scaffolding", () => {
    expect(isScaffoldingParagraph("## Short answer")).toBe(true);
    expect(isScaffoldingParagraph("# Title")).toBe(true);
    expect(isScaffoldingParagraph("###### Deep heading")).toBe(true);
  });

  it("treats horizontal rules as scaffolding", () => {
    expect(isScaffoldingParagraph("---")).toBe(true);
    expect(isScaffoldingParagraph("***")).toBe(true);
  });

  it("treats short intro sentences as scaffolding", () => {
    expect(isScaffoldingParagraph("Here is my complete analysis.")).toBe(true);
    expect(
      isScaffoldingParagraph(
        "I now have all the evidence needed. Here are the verified findings.",
      ),
    ).toBe(true);
  });

  it("treats substantive paragraphs as non-scaffolding", () => {
    expect(isScaffoldingParagraph(SUBSTANCE)).toBe(false);
    expect(isScaffoldingParagraph("```nix\n{ a = 1; }\n```")).toBe(false);
    expect(isScaffoldingParagraph("| a | b |\n|---|---|\n| 1 | 2 |")).toBe(
      false,
    );
  });

  it("does not treat a multi-line block starting with a heading as scaffolding", () => {
    expect(isScaffoldingParagraph("# Title\n\nbody")).toBe(false);
  });
});

describe("selectCollapsedPreview", () => {
  it("shows the whole response when it has few substantive paragraphs", () => {
    const text = "## Summary\n\nHere is the answer.";
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).toBe(text);
    expect(hidden).toBe(0);
  });

  it("keeps leading scaffolding for free and counts only substance", () => {
    // Heading + short intro + one substance paragraph. All shown, nothing
    // hidden because only one substantive paragraph exists.
    const text = `## Summary\n\nHere is my analysis.\n\n${SUBSTANCE}`;
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).toBe(text);
    expect(hidden).toBe(0);
  });

  it("stops after three substantive paragraphs and hides the rest", () => {
    const text = [
      "## Short answer",
      "Intro line.", // scaffolding (short)
      SUBSTANCE,
      `${SUBSTANCE} (two)`,
      `${SUBSTANCE} (three)`,
      `${SUBSTANCE} (four)`,
      `${SUBSTANCE} (five)`,
    ].join("\n\n");
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).toContain("(three)");
    expect(preview).not.toContain("(four)");
    expect(hidden).toBe(2);
  });

  it("does not show trailing scaffolding once the substance budget is spent", () => {
    const text = [
      "Intro.", // scaffolding
      SUBSTANCE,
      `${SUBSTANCE} (two)`,
      `${SUBSTANCE} (three)`,
      "## Trailing heading", // scaffolding after budget spent
    ].join("\n\n");
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).not.toContain("Trailing heading");
    expect(hidden).toBe(1);
  });

  it("keeps interspersed scaffolding (rules, headings) for free", () => {
    const text = [
      "Here is my analysis.", // scaffolding
      "---", // scaffolding
      "## Short Answer", // scaffolding
      SUBSTANCE,
      "---", // scaffolding (interspersed)
      "## Details", // scaffolding
      `${SUBSTANCE} (two)`,
    ].join("\n\n");
    const { preview, hidden } = selectCollapsedPreview(text);
    // Everything shown: only 2 substance paragraphs, both within budget.
    expect(preview).toBe(text);
    expect(hidden).toBe(0);
  });

  it("does not burn the whole budget on a lone heading", () => {
    // Regression for the old behavior, which showed only the first paragraph.
    const text = [
      "Here is my complete analysis.", // scaffolding
      "---",
      "## Short Answer",
      SUBSTANCE,
      "## Relevant Files",
      `${SUBSTANCE} (two)`,
    ].join("\n\n");
    const { preview } = selectCollapsedPreview(text);
    expect(preview).toContain(SUBSTANCE);
    expect(preview).toContain("(two)");
  });

  it("hard-truncates a single oversized substance paragraph", () => {
    const huge = "A".repeat(5000);
    const text = `## Heading\n\n${huge}`;
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview.length).toBeLessThan(5000);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview).toContain("## Heading");
    expect(hidden).toBe(0);
  });

  it("returns trimmed text for blank input", () => {
    const { preview, hidden } = selectCollapsedPreview("   ");
    expect(preview).toBe("");
    expect(hidden).toBe(0);
  });

  it("shows all scaffolding when there is no substance, bounded by the hard cap", () => {
    // A response of only headings: all shown, none hidden.
    const text = "## A\n\n## B\n\n## C";
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).toBe(text);
    expect(hidden).toBe(0);
  });

  it("stops at the character budget even before three substance paragraphs", () => {
    const long1 = `Substance one. ${"x".repeat(600)}`;
    const long2 = `Substance two. ${"y".repeat(600)}`;
    const long3 = "Substance three should not appear.";
    const text = [long1, long2, long3].join("\n\n");
    const { preview, hidden } = selectCollapsedPreview(text);
    expect(preview).toContain(long1);
    expect(preview).toContain(long2);
    expect(preview).not.toContain("Substance three should not appear");
    expect(hidden).toBe(1);
  });

  it("counts hidden paragraphs honestly (scaffolding shown does not reduce the count)", () => {
    const text = [
      "Intro.", // scaffolding, shown free
      SUBSTANCE,
      `${SUBSTANCE} (two)`,
      `${SUBSTANCE} (three)`,
      `${SUBSTANCE} (hidden one)`,
      `${SUBSTANCE} (hidden two)`,
    ].join("\n\n");
    const { hidden } = selectCollapsedPreview(text);
    expect(hidden).toBe(2);
  });
});
