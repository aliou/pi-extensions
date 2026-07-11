import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { expect, test } from "vitest";
import { createSkillAutocompleteEditor } from "./editor";
import { createSkillAutocompleteProvider, extractSkillToken } from "./provider";

const current = {
  getSuggestions: async () => null,
  applyCompletion: () => ({ lines: [], cursorLine: 0, cursorCol: 0 }),
} as AutocompleteProvider;

test("recognizes ?? as the force-show skill trigger", () => {
  expect(extractSkillToken("??")).toEqual({ trigger: "??", token: "" });
  expect(extractSkillToken("?vit")).toEqual({ trigger: "?", token: "vit" });
});

test("shows all skills for ??", async () => {
  const root = mkdtempSync(join(tmpdir(), "skill-autocomplete-"));
  mkdirSync(join(root, "alpha"));
  mkdirSync(join(root, "beta"));

  try {
    const provider = createSkillAutocompleteProvider(current, [root]);
    const suggestions = await provider.getSuggestions(["??"], 0, 2, {
      signal: new AbortController().signal,
    });

    expect(suggestions).toMatchObject({
      prefix: "??",
      items: [{ label: "alpha" }, { label: "beta" }],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requests completion when the second ? is typed", async () => {
  const calls: string[] = [];
  const editor = createSkillAutocompleteEditor(
    { requestRender: () => {} } as never,
    { borderColor: (text: string) => text, selectList: {} } as never,
    { matches: () => false } as never,
  );
  editor.setAutocompleteProvider({
    triggerCharacters: ["?"],
    getSuggestions: async (lines) => {
      calls.push(lines.join("\n"));
      return null;
    },
    applyCompletion: () => ({ lines: [""], cursorLine: 0, cursorCol: 0 }),
  });

  editor.handleInput("?");
  await new Promise((resolve) => setTimeout(resolve, 30));
  editor.handleInput("?");
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(calls).toEqual(["?", "??"]);
});
