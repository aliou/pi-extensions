import { describe, expect, it } from "vitest";
import {
  createPrefixCompletionItem,
  extractPrefixCandidate,
  prependCompletionItem,
  replaceAutocompletePrefix,
} from "./index";

describe("replaceAutocompletePrefix", () => {
  it("replaces the prefix before the cursor", () => {
    const result = replaceAutocompletePrefix(["cd @z"], 0, 5, "@z", "@z:");

    expect(result).toEqual({
      lines: ["cd @z:"],
      cursorLine: 0,
      cursorCol: 6,
    });
  });

  it("preserves text after the cursor", () => {
    const result = replaceAutocompletePrefix(["use @ now"], 0, 5, "@", "@z:");

    expect(result.lines).toEqual(["use @z: now"]);
    expect(result.cursorCol).toBe(7);
  });
});

describe("createPrefixCompletionItem", () => {
  it("creates an autocomplete item", () => {
    expect(
      createPrefixCompletionItem({
        value: "@z:",
        description: "zoxide entries",
      }),
    ).toEqual({
      value: "@z:",
      label: "@z:",
      description: "zoxide entries",
    });
  });
});

describe("extractPrefixCandidate", () => {
  it("returns the typed candidate while it is inside the target prefix", () => {
    expect(extractPrefixCandidate("@", "@z:")).toBe("@");
    expect(extractPrefixCandidate("@z", "@z:")).toBe("@z");
    expect(extractPrefixCandidate("switch @z", "@z:")).toBe("@z");
  });

  it("returns undefined for unrelated candidates", () => {
    expect(extractPrefixCandidate("@x", "@z:")).toBeUndefined();
    expect(extractPrefixCandidate("email@", "@z:")).toBeUndefined();
  });
});

describe("prependCompletionItem", () => {
  it("prepends the item and deduplicates by value", () => {
    expect(
      prependCompletionItem(
        [
          { value: "a", label: "a" },
          { value: "@z:", label: "old" },
        ],
        { value: "@z:", label: "@z:" },
      ),
    ).toEqual([
      { value: "@z:", label: "@z:" },
      { value: "a", label: "a" },
    ]);
  });
});
