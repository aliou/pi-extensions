import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import {
  SkillDescriptionPreviewComponent,
  SkillInvocationMessageComponent,
  type SkillMessageTheme,
} from "./skill";

const theme: SkillMessageTheme = {
  fg: (_color, text) => text,
  bg: (_color, text) => text,
  bold: (text) => text,
  italic: (text) => text,
  strikethrough: (text) => text,
  underline: (text) => text,
};

function plainLines(component: { render(width: number): string[] }): string[] {
  return component
    .render(120)
    .map((line) => stripTerminalSequences(line).trimEnd());
}

describe("SkillDescriptionPreview", () => {
  it("renders the full description", () => {
    const description =
      "Vitest testing patterns and conventions. Use when writing, reviewing, or refactoring tests that use vitest.";
    expect(
      plainLines(new SkillDescriptionPreviewComponent(theme, description)),
    ).toEqual([description]);
  });

  it("can include a leading blank line for tool result spacing", () => {
    const component = new SkillDescriptionPreviewComponent(
      theme,
      "Description",
      true,
    );
    expect(plainLines(component)).toEqual(["", "Description"]);
  });
});

describe("SkillInvocationMessageComponent", () => {
  it("shows the skill header and full description when collapsed", () => {
    const component = new SkillInvocationMessageComponent({
      name: "vitest",
      content: "# Vitest\n\nUse vitest.",
      description: "Vitest testing patterns and conventions.",
      expanded: false,
      expandHint: "ctrl+x",
      theme,
    });

    const lines = plainLines(component);
    expect(lines).toContain(" [skill] vitest (ctrl+x to expand)");
    expect(lines).toContain(" Vitest testing patterns and conventions.");
  });

  it("renders the full skill content as markdown when expanded", () => {
    const component = new SkillInvocationMessageComponent({
      name: "vitest",
      content: "# Vitest\n\nUse **vitest**.",
      description: "Vitest testing patterns and conventions.",
      expanded: true,
      expandHint: "ctrl+x",
      theme,
    });

    const lines = plainLines(component);
    expect(lines).toContain(" [skill]");
    expect(lines.some((line) => line.includes("vitest"))).toBe(true);
    expect(lines.some((line) => line.includes("Use vitest."))).toBe(true);
  });
});
