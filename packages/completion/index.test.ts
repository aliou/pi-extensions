import { describe, expect, it } from "vitest";
import {
  createPrefixCompletionItem,
  extractPrefixCandidate,
  prependCompletionItem,
  replaceAutocompletePrefix,
} from "./index";

describe("replaceAutocompletePrefix", () => {
  it("replaces the prefix before the cursor", () => {
    const result = replaceAutocompletePrefix(
      ["checkout @g"],
      0,
      11,
      "@g",
      "@g:",
    );

    expect(result).toEqual({
      lines: ["checkout @g:"],
      cursorLine: 0,
      cursorCol: 12,
    });
  });

  it("preserves text after the cursor", () => {
    const result = replaceAutocompletePrefix(["use @ now"], 0, 5, "@", "@g:");

    expect(result.lines).toEqual(["use @g: now"]);
    expect(result.cursorCol).toBe(7);
  });
});

describe("createPrefixCompletionItem", () => {
  it("creates an autocomplete item", () => {
    expect(
      createPrefixCompletionItem({
        value: "@g:",
        description: "local git branches",
      }),
    ).toEqual({
      value: "@g:",
      label: "@g:",
      description: "local git branches",
    });
  });
});

describe("extractPrefixCandidate", () => {
  it("returns the typed candidate while it is inside the target prefix", () => {
    expect(extractPrefixCandidate("@", "@g:")).toBe("@");
    expect(extractPrefixCandidate("@g", "@g:")).toBe("@g");
    expect(extractPrefixCandidate("switch @g", "@g:")).toBe("@g");
  });

  it("returns undefined for unrelated candidates", () => {
    expect(extractPrefixCandidate("@x", "@g:")).toBeUndefined();
    expect(extractPrefixCandidate("email@", "@g:")).toBeUndefined();
  });
});

describe("prependCompletionItem", () => {
  it("prepends the item and deduplicates by value", () => {
    expect(
      prependCompletionItem(
        [
          { value: "a", label: "a" },
          { value: "@g:", label: "old" },
        ],
        { value: "@g:", label: "@g:" },
      ),
    ).toEqual([
      { value: "@g:", label: "@g:" },
      { value: "a", label: "a" },
    ]);
  });
});
